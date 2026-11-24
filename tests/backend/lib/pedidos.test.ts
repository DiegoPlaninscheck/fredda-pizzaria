import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  PedidoError, cancelarPedido, confirmarPedido, criarPedido, entregarPedido,
  formatarMoeda, mensagemDeStatus, resumoItens,
} from '@/lib/pedidos'
import { metricas } from '@/lib/metricas'
import { criarCliente, criarReceita, criarUsuario, decimal } from '../helpers/db'

const estoque = async (id: string) => decimal((await prisma.receita.findUniqueOrThrow({ where: { id } })).estoqueAtual)
const totalMetrica = async (status: string) =>
  (await metricas.pedidos.get()).values.filter((v) => v.labels.status === status).reduce((s, v) => s + v.value, 0)

async function base() {
  const cliente = await criarCliente({ nome: 'Ana' })
  const margherita = await criarReceita({ nome: 'Margherita', estoque: 10, preco: 42 })
  const calabrese = await criarReceita({ nome: 'Calabrese', estoque: 4, preco: 48.5 })
  return { cliente, margherita, calabrese }
}

describe('criar pedido', () => {
  it('reserva o estoque e usa o preço atual do cardápio, juntando itens repetidos', async () => {
    const { cliente, margherita, calabrese } = await base()
    const antes = await totalMetrica('PENDENTE')

    const pedido = await criarPedido({
      clienteId: cliente.id,
      tipoEntrega: 'RETIRADA',
      itens: [
        { receitaId: margherita.id, quantidade: 2 },
        { receitaId: calabrese.id, quantidade: 1 },
        { receitaId: margherita.id, quantidade: 1 },
      ],
    })

    expect(pedido.status).toBe('PENDENTE')
    expect(pedido.itens).toHaveLength(2)
    expect(decimal(pedido.valorTotal)).toBe(3 * 42 + 48.5)
    expect(await estoque(margherita.id)).toBe(7)
    expect(await estoque(calabrese.id)).toBe(3)
    expect(await totalMetrica('PENDENTE')).toBe(antes + 1)
  })

  it('guarda o endereço só quando é entrega', async () => {
    const { cliente, margherita } = await base()
    const entrega = await criarPedido({
      clienteId: cliente.id, tipoEntrega: 'ENTREGA', enderecoEntrega: '  Rua A, 10  ',
      itens: [{ receitaId: margherita.id, quantidade: 1 }],
    })
    expect(entrega.enderecoEntrega).toBe('Rua A, 10')

    const retirada = await criarPedido({
      clienteId: cliente.id, tipoEntrega: 'RETIRADA', enderecoEntrega: 'ignorado',
      itens: [{ receitaId: margherita.id, quantidade: 1 }],
    })
    expect(retirada.enderecoEntrega).toBeNull()
  })

  it.each([
    [[{ quantidade: 0 }], 'Quantidades devem ser números inteiros maiores que zero'],
    [[{ quantidade: 1.5 }], 'Quantidades devem ser números inteiros maiores que zero'],
    [[], 'O pedido precisa de ao menos um item'],
  ])('recusa itens inválidos (%j)', async (itens, mensagem) => {
    const { cliente, margherita } = await base()
    await expect(criarPedido({
      clienteId: cliente.id, tipoEntrega: 'RETIRADA',
      itens: itens.map((i) => ({ receitaId: margherita.id, quantidade: i.quantidade })),
    })).rejects.toThrow(new PedidoError(mensagem))
  })

  it('recusa entrega sem endereço', async () => {
    const { cliente, margherita } = await base()
    await expect(criarPedido({
      clienteId: cliente.id, tipoEntrega: 'ENTREGA', enderecoEntrega: '   ',
      itens: [{ receitaId: margherita.id, quantidade: 1 }],
    })).rejects.toThrow('Endereço é obrigatório para entrega')
  })

  it('recusa sabor fora do cardápio (sem preço ou inativo)', async () => {
    const { cliente } = await base()
    const semPreco = await criarReceita({ preco: null, estoque: 5 })
    const inativo = await criarReceita({ ativo: false, estoque: 5 })
    for (const receita of [semPreco, inativo]) {
      await expect(criarPedido({
        clienteId: cliente.id, tipoEntrega: 'RETIRADA', itens: [{ receitaId: receita.id, quantidade: 1 }],
      })).rejects.toThrow('Um ou mais itens não estão disponíveis no cardápio')
    }
  })

  it('sem estoque suficiente não cria o pedido nem reserva nada', async () => {
    const { cliente, margherita, calabrese } = await base()
    await expect(criarPedido({
      clienteId: cliente.id, tipoEntrega: 'RETIRADA',
      itens: [{ receitaId: margherita.id, quantidade: 2 }, { receitaId: calabrese.id, quantidade: 5 }],
    })).rejects.toThrow(/Estoque insuficiente de Calabrese/)

    expect(await estoque(margherita.id)).toBe(10)
    expect(await prisma.pedido.count()).toBe(0)
  })
})

describe('ciclo de vida do pedido', () => {
  async function pedidoPendente() {
    const dados = await base()
    const usuario = await criarUsuario()
    const pedido = await criarPedido({
      clienteId: dados.cliente.id, tipoEntrega: 'RETIRADA', formaPagamento: 'PIX',
      itens: [{ receitaId: dados.margherita.id, quantidade: 2 }, { receitaId: dados.calabrese.id, quantidade: 1 }],
    })
    return { ...dados, usuario, pedido }
  }

  it('confirmar gera uma venda por item, sem baixar o estoque de novo', async () => {
    const { pedido, usuario, margherita } = await pedidoPendente()
    const confirmado = await confirmarPedido(pedido.id, usuario.id)

    expect(confirmado.status).toBe('CONFIRMADO')
    const vendas = await prisma.venda.findMany({ where: { pedidoId: pedido.id } })
    expect(vendas).toHaveLength(2)
    expect(vendas.every((v) => v.cliente === 'Ana' && v.formaPagamento === 'PIX' && !v.pago && !v.entregue)).toBe(true)
    expect(vendas.map((v) => decimal(v.valorTotal)).sort((a, b) => a - b)).toEqual([48.5, 84])
    expect(await estoque(margherita.id)).toBe(8)
  })

  it('entregar marca as vendas como entregues', async () => {
    const { pedido, usuario } = await pedidoPendente()
    await confirmarPedido(pedido.id, usuario.id)
    const entregue = await entregarPedido(pedido.id)

    expect(entregue.status).toBe('ENTREGUE')
    const vendas = await prisma.venda.findMany({ where: { pedidoId: pedido.id } })
    expect(vendas.every((v) => v.entregue && v.dataEntrega)).toBe(true)
  })

  it('cancelar um pedido confirmado devolve o estoque e remove as vendas', async () => {
    const { pedido, usuario, margherita, calabrese } = await pedidoPendente()
    await confirmarPedido(pedido.id, usuario.id)
    const cancelado = await cancelarPedido(pedido.id)

    expect(cancelado.status).toBe('CANCELADO')
    expect(await estoque(margherita.id)).toBe(10)
    expect(await estoque(calabrese.id)).toBe(4)
    expect(await prisma.venda.count({ where: { pedidoId: pedido.id } })).toBe(0)
  })

  it('o cliente só pode cancelar enquanto o pedido aguarda confirmação', async () => {
    const { pedido, usuario } = await pedidoPendente()
    await confirmarPedido(pedido.id, usuario.id)
    await expect(cancelarPedido(pedido.id, { apenasPendente: true })).rejects.toThrow(`Pedido #${pedido.id} está confirmado`)
  })

  it('não permite pular etapas nem voltar de um pedido cancelado', async () => {
    const { pedido, usuario } = await pedidoPendente()
    await expect(entregarPedido(pedido.id)).rejects.toThrow(/aguardando confirmação/)
    await cancelarPedido(pedido.id)
    await expect(confirmarPedido(pedido.id, usuario.id)).rejects.toThrow(/cancelado/)
    await expect(cancelarPedido(pedido.id)).rejects.toThrow(/cancelado/) // não devolve o estoque duas vezes
  })

  it('pedido inexistente gera erro claro', async () => {
    const usuario = await criarUsuario()
    await expect(confirmarPedido(999999, usuario.id)).rejects.toThrow('Pedido #999999 não encontrado')
  })
})

describe('mensagens do pedido', () => {
  it('formata moeda, resumo dos itens e o aviso de cada status', async () => {
    const { cliente, margherita } = await base()
    const pedido = await criarPedido({
      clienteId: cliente.id, tipoEntrega: 'ENTREGA', enderecoEntrega: 'Rua B',
      itens: [{ receitaId: margherita.id, quantidade: 2 }],
    })

    expect(formatarMoeda(84).replace(/\s/g, ' ')).toBe('R$ 84,00')
    expect(resumoItens(pedido)).toMatch(/^2x Margherita \(R\$\s42,00\)$/)
    expect(mensagemDeStatus(pedido)).toBe(`Pedido #${pedido.id}: Aguardando confirmação`)
    expect(mensagemDeStatus({ ...pedido, status: 'CONFIRMADO' })).toMatch(/confirmado![\s\S]*sair para entrega/)
    expect(mensagemDeStatus({ ...pedido, status: 'CONFIRMADO', tipoEntrega: 'RETIRADA' })).toMatch(/pronto para retirada/)
    expect(mensagemDeStatus({ ...pedido, status: 'ENTREGUE' })).toMatch(/entregue/)
    expect(mensagemDeStatus({ ...pedido, status: 'CANCELADO' })).toMatch(/foi cancelado/)
  })
})
