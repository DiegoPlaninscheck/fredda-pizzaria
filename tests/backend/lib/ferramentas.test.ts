import { describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { criarFerramentas } from '@/lib/chatbot/ferramentas'
import { criarCliente, criarConversa, criarReceita, decimal } from '../helpers/db'

/** Executa uma ferramenta da IA como o SDK faz: valida a entrada pelo schema e roda. */
async function contexto(opcoesCliente: Parameters<typeof criarCliente>[0] = {}) {
  const cliente = await criarCliente(opcoesCliente)
  const conversa = await criarConversa(cliente.id)
  const ferramentas = criarFerramentas({ clienteId: cliente.id, conversaId: conversa.id }) as any[]
  const usar = async (nome: string, entrada: unknown = {}) => {
    const f = ferramentas.find((t) => t.name === nome)
    if (!f) throw new Error(`ferramenta ${nome} não existe`)
    return JSON.parse(await f.run(f.parse ? f.parse(entrada) : entrada))
  }
  return { cliente, conversa, ferramentas, usar }
}

describe('ferramentas da IA do chatbot', () => {
  it('são 7, todas em modo strict, sem restrições que o modo strict não aceita', async () => {
    const { ferramentas } = await contexto()
    expect(ferramentas.map((t) => t.name)).toEqual([
      'ver_cardapio', 'obter_cliente', 'salvar_cliente', 'criar_pedido', 'meus_pedidos', 'cancelar_pedido', 'chamar_atendente',
    ])
    expect(ferramentas.every((t) => t.strict === true)).toBe(true)
    const schema = JSON.stringify(ferramentas.find((t) => t.name === 'criar_pedido').input_schema)
    expect(schema).not.toMatch(/"minimum"|"\$schema"/)
    expect(schema).toContain('"additionalProperties":false')
  })

  it('ver_cardapio mostra só sabores à venda, com preço e quantidade disponível', async () => {
    await criarReceita({ nome: 'Margherita', estoque: 4.7, preco: 42 })
    await criarReceita({ nome: 'Sem preço', preco: null, estoque: 3 })
    await criarReceita({ nome: 'Inativa', ativo: false, estoque: 3 })
    const { usar } = await contexto()
    const cardapio = await usar('ver_cardapio')
    expect(cardapio).toHaveLength(1)
    expect(cardapio[0]).toMatchObject({ sabor: 'Margherita', disponivel: 4 })
    expect(cardapio[0].preco).toMatch(/R\$\s42,00/)
  })

  it('obter_cliente e salvar_cliente usam sempre o cliente da conversa', async () => {
    const { usar, cliente } = await contexto({ nome: null })
    expect(await usar('obter_cliente')).toEqual({ nome: null, endereco: null })
    await usar('salvar_cliente', { nome: '  Ana  ', endereco: 'Rua A, 1' })
    expect(await prisma.cliente.findUniqueOrThrow({ where: { id: cliente.id } })).toMatchObject({ nome: 'Ana', endereco: 'Rua A, 1' })
  })

  it('criar_pedido registra o pedido deste cliente com o endereço salvo e o preço do cardápio', async () => {
    const sabor = await criarReceita({ nome: 'Calabrese', estoque: 10, preco: 48 })
    const { usar, cliente, conversa } = await contexto({ nome: 'Ana', endereco: 'Rua Salva, 9' })

    const r = await usar('criar_pedido', {
      itens: [{ receitaId: sabor.id, quantidade: 2 }], tipoEntrega: 'ENTREGA', formaPagamento: 'PIX', dataEntregaDesejada: '2026-11-28',
    })

    expect(r).toMatchObject({ itens: [{ sabor: 'Calabrese', quantidade: 2 }], status: 'Aguardando confirmação' })
    const pedido = await prisma.pedido.findUniqueOrThrow({ where: { id: r.numero } })
    expect(pedido).toMatchObject({ clienteId: cliente.id, conversaId: conversa.id, enderecoEntrega: 'Rua Salva, 9', formaPagamento: 'PIX' })
    expect(decimal(pedido.valorTotal)).toBe(96)
  })

  it('criar_pedido recusa sem nome do cliente, acima do limite de unidades e com data inválida', async () => {
    const sabor = await criarReceita({ estoque: 100 })
    const semNome = await contexto({ nome: null })
    expect(await semNome.usar('criar_pedido', { itens: [{ receitaId: sabor.id, quantidade: 1 }], tipoEntrega: 'RETIRADA', formaPagamento: 'PIX' }))
      .toEqual({ erro: expect.stringMatching(/Nome do cliente não informado/) })

    const { usar } = await contexto({ nome: 'Ana' })
    expect(await usar('criar_pedido', { itens: [{ receitaId: sabor.id, quantidade: 31 }], tipoEntrega: 'RETIRADA', formaPagamento: 'PIX' }))
      .toEqual({ erro: 'Pedidos acima de 30 unidades precisam ser feitos com um atendente.' })
    expect(await usar('criar_pedido', { itens: [{ receitaId: sabor.id, quantidade: 1 }], tipoEntrega: 'RETIRADA', formaPagamento: 'PIX', dataEntregaDesejada: 'amanhã' }))
      .toEqual({ erro: 'Data inválida, use AAAA-MM-DD.' })
  })

  it('criar_pedido devolve o erro de negócio para a IA explicar ao cliente (ex.: sem estoque)', async () => {
    const sabor = await criarReceita({ nome: 'Margherita', estoque: 1 })
    const { usar } = await contexto({ nome: 'Ana' })
    expect(await usar('criar_pedido', { itens: [{ receitaId: sabor.id, quantidade: 2 }], tipoEntrega: 'RETIRADA', formaPagamento: 'PIX' }))
      .toEqual({ erro: expect.stringMatching(/Estoque insuficiente de Margherita/) })
  })

  it('meus_pedidos e cancelar_pedido só enxergam os pedidos deste cliente', async () => {
    const { usar, cliente } = await contexto()
    const outro = await criarCliente()
    const meu = await prisma.pedido.create({ data: { clienteId: cliente.id, tipoEntrega: 'RETIRADA', valorTotal: 42 } })
    const alheio = await prisma.pedido.create({ data: { clienteId: outro.id, tipoEntrega: 'RETIRADA', valorTotal: 42 } })

    const lista = await usar('meus_pedidos')
    expect(lista.map((p: { numero: number }) => p.numero)).toEqual([meu.id])

    expect(await usar('cancelar_pedido', { numero: alheio.id })).toEqual({ erro: `Pedido #${alheio.id} não encontrado para este cliente.` })
    expect((await prisma.pedido.findUniqueOrThrow({ where: { id: alheio.id } })).status).toBe('PENDENTE')

    expect(await usar('cancelar_pedido', { numero: meu.id })).toEqual({ ok: true, numero: meu.id })
    expect(await usar('cancelar_pedido', { numero: meu.id })).toEqual({ erro: expect.stringMatching(/está cancelado e não pode ser cancelado/) })
  })

  it('chamar_atendente passa a conversa para a equipe', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const { usar, conversa } = await contexto()
    expect(await usar('chamar_atendente', { motivo: 'quer pedido para evento' })).toEqual({ ok: true })
    expect((await prisma.conversa.findUniqueOrThrow({ where: { id: conversa.id } })).status).toBe('HUMANO')
  })
})
