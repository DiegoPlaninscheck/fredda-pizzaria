import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import * as vendas from '@/app/api/vendas/route'
import * as venda from '@/app/api/vendas/[id]/route'
import * as ordens from '@/app/api/ordens/route'
import * as ordem from '@/app/api/ordens/[id]/route'
import * as etapa from '@/app/api/ordens/[id]/etapas/[etapaId]/route'
import * as condicoes from '@/app/api/ordens/[id]/etapas/[etapaId]/condicoes/route'
import { logarComo } from '../helpers/auth'
import { lerResposta, params, requisicao } from '../helpers/http'
import { criarInsumo, criarReceita, criarUsuario, decimal } from '../helpers/db'

const estoqueReceita = async (id: string) => decimal((await prisma.receita.findUniqueOrThrow({ where: { id } })).estoqueAtual)
const estoqueInsumo = async (id: string) => decimal((await prisma.insumo.findUniqueOrThrow({ where: { id } })).estoqueAtual)

describe('vendas', () => {
  it('registrar baixa o estoque de produto pronto; sem estoque responde 422', async () => {
    const u = await criarUsuario()
    const r = await criarReceita({ nome: 'Margherita', estoque: 5 })
    logarComo('OPERADOR', u.id)
    const rota = (corpo: object) => vendas.POST(requisicao('POST', '/api/vendas', corpo))

    const criada = await lerResposta(await rota({ receitaId: r.id, cliente: ' João ', quantidade: 2, precoUnitario: 42, pago: true, formaPagamento: 'PIX' }))
    expect(criada).toMatchObject({ status: 201, json: { cliente: 'João', valorTotal: '84', pago: true, entregue: false } })
    expect(await estoqueReceita(r.id)).toBe(3)

    expect(await lerResposta(await rota({ receitaId: r.id, cliente: 'Maria', quantidade: 10, precoUnitario: 42 })))
      .toEqual({ status: 422, json: { error: 'Estoque insuficiente de Margherita. Disponível: 3' } })
  })

  it.each([
    [{ cliente: 'X', quantidade: 1, precoUnitario: 1 }, 'Receita é obrigatória'],
    [{ receitaId: 'r', cliente: ' ', quantidade: 1, precoUnitario: 1 }, 'Cliente é obrigatório'],
    [{ receitaId: 'r', cliente: 'X', quantidade: 0, precoUnitario: 1 }, 'Quantidade deve ser maior que zero'],
    [{ receitaId: 'r', cliente: 'X', quantidade: 1, precoUnitario: 0 }, 'Preço unitário deve ser maior que zero'],
  ])('valida a entrada (%j)', async (corpo, erro) => {
    logarComo('OPERADOR')
    expect(await lerResposta(await vendas.POST(requisicao('POST', '/api/vendas', corpo)))).toEqual({ status: 400, json: { error: erro } })
  })

  it('receita inexistente → 404', async () => {
    logarComo('OPERADOR')
    expect((await vendas.POST(requisicao('POST', '/api/vendas', { receitaId: 'nao-existe', cliente: 'X', quantidade: 1, precoUnitario: 1 }))).status).toBe(404)
  })

  it('filtra por sabor e por período em dias do horário de Brasília (independe do fuso do servidor)', async () => {
    const u = await criarUsuario()
    const [a, b] = [await criarReceita(), await criarReceita()]
    const v = (receitaId: string, data: string) => prisma.venda.create({ data: { cliente: data, quantidade: 1, precoUnitario: 1, valorTotal: 1, receitaId, usuarioId: u.id, dataVenda: new Date(data) } })
    await v(a.id, '2026-11-14T22:00:00-03:00') // véspera do início, à noite (já é dia 15 em UTC): fora
    await v(a.id, '2026-11-15T00:30:00-03:00') // começo do primeiro dia: dentro
    await v(a.id, '2026-11-20T23:30:00-03:00') // fim do último dia (já é dia 21 em UTC): dentro
    await v(a.id, '2026-11-21T00:10:00-03:00') // dia seguinte ao fim: fora
    await v(b.id, '2026-11-18T12:00:00-03:00') // outro sabor: fora
    logarComo('OPERADOR', u.id)

    const filtro = await lerResposta(await vendas.GET(requisicao('GET', `/api/vendas?receitaId=${a.id}&dataInicio=2026-11-15&dataFim=2026-11-20`)))
    expect(filtro.json.map((x: { cliente: string }) => x.cliente).sort()).toEqual(['2026-11-15T00:30:00-03:00', '2026-11-20T23:30:00-03:00'])
    expect((await lerResposta(await vendas.GET(requisicao('GET', '/api/vendas')))).json).toHaveLength(5)
  })

  it('marcar como entregue preenche a data de entrega; cancelar (ADMIN) devolve o estoque', async () => {
    const u = await criarUsuario()
    const r = await criarReceita({ estoque: 0 })
    const v = await prisma.venda.create({ data: { cliente: 'X', quantidade: 3, precoUnitario: 1, valorTotal: 3, receitaId: r.id, usuarioId: u.id } })
    logarComo('OPERADOR', u.id)

    const atualizada = await lerResposta(await venda.PATCH(requisicao('PATCH', '/x', { pago: true, entregue: true }), params({ id: v.id })))
    expect(atualizada.json).toMatchObject({ pago: true, entregue: true })
    expect(atualizada.json.dataEntrega).not.toBeNull()
    expect((await venda.PATCH(requisicao('PATCH', '/x', { dataEntrega: null }), params({ id: v.id }))).status).toBe(200)
    expect((await venda.PATCH(requisicao('PATCH', '/x', {}), params({ id: 'nao-existe' }))).status).toBe(404)
    expect((await venda.DELETE(requisicao('DELETE', '/x'), params({ id: v.id }))).status).toBe(403)

    logarComo('ADMIN', u.id)
    expect((await venda.DELETE(requisicao('DELETE', '/x'), params({ id: v.id }))).status).toBe(200)
    expect(await estoqueReceita(r.id)).toBe(3)
    expect((await venda.DELETE(requisicao('DELETE', '/x'), params({ id: v.id }))).status).toBe(404)
  })

  it('venda gerada por pedido não pode ser cancelada direto (cancela-se o pedido)', async () => {
    const u = await criarUsuario()
    const r = await criarReceita()
    const cliente = await prisma.cliente.create({ data: { telefone: '5547000' } })
    const p = await prisma.pedido.create({ data: { clienteId: cliente.id, tipoEntrega: 'RETIRADA', valorTotal: 1 } })
    const v = await prisma.venda.create({ data: { cliente: 'X', quantidade: 1, precoUnitario: 1, valorTotal: 1, receitaId: r.id, usuarioId: u.id, pedidoId: p.id } })
    logarComo('ADMIN', u.id)
    expect(await lerResposta(await venda.DELETE(requisicao('DELETE', '/x'), params({ id: v.id }))))
      .toEqual({ status: 409, json: { error: `Esta venda foi gerada pelo pedido #${p.id}. Cancele o pedido em vez da venda.` } })
  })
})

describe('ordens de produção', () => {
  async function criarOrdemPelaRota(estoqueFarinha: number) {
    const u = await criarUsuario()
    const farinha = await criarInsumo({ nome: 'Farinha', estoque: estoqueFarinha })
    const margherita = await criarReceita({ nome: 'Margherita', ingredientes: [{ insumoId: farinha.id, quantidade: 0.3 }] })
    const calabrese = await criarReceita({ nome: 'Calabrese', ingredientes: [{ insumoId: farinha.id, quantidade: 0.3 }] })
    logarComo('OPERADOR', u.id)
    const res = await lerResposta(await ordens.POST(requisicao('POST', '/api/ordens', {
      receitas: [{ receitaId: margherita.id, quantidade: 10 }, { receitaId: calabrese.id, quantidade: 10 }],
      dataPrevista: '2026-11-28', observacoes: ' lote do fim de semana ',
    })))
    return { u, farinha, margherita, calabrese, res }
  }

  it('criar baixa os insumos de todas as receitas e cria as 5 etapas de fermentação', async () => {
    const { farinha, res } = await criarOrdemPelaRota(10)
    expect(res.status).toBe(201)
    expect(res.json.insuficientes).toEqual([])
    expect(res.json.etapas.map((e: { nome: string; duracaoMinutos: number }) => [e.nome, e.duracaoMinutos])).toEqual([
      ['MISTURA', 30], ['DESCANSO_INICIAL', 60], ['FERMENTACAO_LONGA', 1440], ['MODELAGEM', 60], ['CONGELAMENTO', 720],
    ])
    expect(await estoqueInsumo(farinha.id)).toBe(4) // 10 − (0,3 × 20)
    const saida = await prisma.movimentacaoEstoque.findFirstOrThrow({ where: { ordemId: res.json.id } })
    expect(decimal(saida.quantidade)).toBe(6)
  })

  it('com insumo insuficiente a ordem é criada mesmo assim: baixa o que há e avisa a falta', async () => {
    // Cada receita sozinha (3 kg) caberia nos 4 kg, mas a ordem inteira precisa de 6 kg
    const { farinha, res } = await criarOrdemPelaRota(4)
    expect(res.status).toBe(201)
    expect(res.json.insuficientes).toEqual([
      { receita: 'Margherita, Calabrese', nome: 'Farinha', necessario: '6.000', disponivel: '4.000' },
    ])
    expect(await estoqueInsumo(farinha.id)).toBe(0)
    const saida = await prisma.movimentacaoEstoque.findFirstOrThrow({ where: { ordemId: res.json.id } })
    expect(decimal(saida.quantidade)).toBe(4)
  })

  it('o aviso de falta é um por insumo, somando o consumo de todas as receitas da ordem', async () => {
    const { res } = await criarOrdemPelaRota(2)
    expect(res.json.insuficientes).toEqual([
      { receita: 'Margherita, Calabrese', nome: 'Farinha', necessario: '6.000', disponivel: '2.000' },
    ])
  })

  it.each([
    [{ receitas: [] }, 400],
    [{ receitas: [{ quantidade: 1 }] }, 400],
    [{ receitas: [{ receitaId: 'a', quantidade: 0 }] }, 400],
    [{ receitas: [{ receitaId: 'a', quantidade: 1 }, { receitaId: 'a', quantidade: 2 }] }, 400],
    [{ receitas: [{ receitaId: 'nao-existe', quantidade: 1 }] }, 404],
  ])('valida a entrada (%j → %i)', async (corpo, status) => {
    logarComo('OPERADOR')
    expect((await ordens.POST(requisicao('POST', '/api/ordens', corpo))).status).toBe(status)
  })

  it('lista por status (sem as canceladas por padrão) e consulta o detalhe', async () => {
    const { res, u } = await criarOrdemPelaRota(10)
    await prisma.ordemProducao.create({ data: { usuarioId: u.id, status: 'CANCELADA' } })
    expect((await lerResposta(await ordens.GET(requisicao('GET', '/api/ordens')))).json).toHaveLength(1)
    expect((await lerResposta(await ordens.GET(requisicao('GET', '/api/ordens?status=CANCELADA')))).json).toHaveLength(1)
    expect((await ordens.GET(requisicao('GET', '/api/ordens?status=XYZ'))).status).toBe(400)
    expect((await ordem.GET(requisicao('GET', '/x'), params({ id: res.json.id }))).status).toBe(200)
    expect((await ordem.GET(requisicao('GET', '/x'), params({ id: 'nao-existe' }))).status).toBe(404)
  })

  it('cancelar pela rota estorna os insumos; concluir duas vezes → 409', async () => {
    const { res, farinha } = await criarOrdemPelaRota(10)
    const rota = (status: string) => ordem.PATCH(requisicao('PATCH', '/x', { status }), params({ id: res.json.id }))
    expect((await rota('PLANEJADA')).status).toBe(400)
    expect(await lerResposta(await rota('CANCELADA'))).toMatchObject({ status: 200, json: { status: 'CANCELADA' } })
    expect(await estoqueInsumo(farinha.id)).toBe(10)
    expect((await rota('CONCLUIDA')).status).toBe(409)
    expect((await ordem.PATCH(requisicao('PATCH', '/x', { status: 'CONCLUIDA' }), params({ id: 'nao-existe' }))).status).toBe(404)
  })

  it('etapas: iniciar, pausar e concluir com timer; só uma em andamento; a última conclui a ordem', async () => {
    const { res, margherita } = await criarOrdemPelaRota(10)
    const ordemId = res.json.id
    const etapas = res.json.etapas as { id: string }[]
    const acao = async (i: number, a: string) => lerResposta(await etapa.PATCH(requisicao('PATCH', '/x', { acao: a }), params({ id: ordemId, etapaId: etapas[i].id })))

    expect((await acao(0, 'PULAR')).status).toBe(400)
    expect((await acao(0, 'PAUSAR')).status).toBe(409)
    expect((await acao(0, 'CONCLUIR')).status).toBe(409)
    expect(await acao(0, 'INICIAR')).toMatchObject({ status: 200, json: { status: 'EM_ANDAMENTO' } })
    expect((await prisma.ordemProducao.findUniqueOrThrow({ where: { id: ordemId } })).status).toBe('EM_ANDAMENTO')
    expect((await acao(0, 'INICIAR')).json).toEqual({ error: 'Etapa já está em andamento' })
    expect((await acao(1, 'INICIAR')).json).toEqual({ error: 'Outra etapa já está em andamento nesta ordem' })

    // 15 minutos de mistura, pausa e retoma
    await prisma.etapaFermentacao.update({ where: { id: etapas[0].id }, data: { iniciadaEm: new Date(Date.now() - 15 * 60000) } })
    expect(await acao(0, 'PAUSAR')).toMatchObject({ json: { status: 'PAUSADA', minutosDecorridos: 15 } })
    expect((await prisma.ordemProducao.findUniqueOrThrow({ where: { id: ordemId } })).status).toBe('PAUSADA')
    expect((await acao(0, 'CONCLUIR')).json).toMatchObject({ status: 'CONCLUIDA', minutosDecorridos: 15 })

    for (const i of [1, 2, 3]) { await acao(i, 'INICIAR'); await acao(i, 'CONCLUIR') }
    expect((await prisma.ordemProducao.findUniqueOrThrow({ where: { id: ordemId } })).status).toBe('EM_ANDAMENTO')
    await acao(4, 'INICIAR'); await acao(4, 'CONCLUIR')

    expect((await prisma.ordemProducao.findUniqueOrThrow({ where: { id: ordemId } })).status).toBe('CONCLUIDA')
    expect(await estoqueReceita(margherita.id)).toBe(10)
    expect((await acao(0, 'INICIAR')).status).toBe(409) // ordem finalizada
  })

  it('etapa de outra ordem → 404', async () => {
    const { res } = await criarOrdemPelaRota(10)
    expect((await etapa.PATCH(requisicao('PATCH', '/x', { acao: 'INICIAR' }), params({ id: 'outra', etapaId: res.json.etapas[0].id }))).status).toBe(404)
  })

  it('registra e lista condições ambientais da etapa', async () => {
    const { res } = await criarOrdemPelaRota(10)
    const p = params({ id: res.json.id, etapaId: res.json.etapas[2].id })
    expect((await condicoes.POST(requisicao('POST', '/x', { observacoes: ' ' }), p)).status).toBe(400)
    expect(await lerResposta(await condicoes.POST(requisicao('POST', '/x', { temperatura: '4.5', umidade: 70, observacoes: ' geladeira ok ' }), p)))
      .toMatchObject({ status: 201, json: { temperatura: '4.5', umidade: '70', observacoes: 'geladeira ok' } })
    expect((await lerResposta(await condicoes.GET(requisicao('GET', '/x'), p))).json).toHaveLength(1)
  })
})
