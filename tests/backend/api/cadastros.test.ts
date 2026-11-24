import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import * as categorias from '@/app/api/categorias/route'
import * as categoria from '@/app/api/categorias/[id]/route'
import * as fornecedores from '@/app/api/fornecedores/route'
import * as fornecedor from '@/app/api/fornecedores/[id]/route'
import * as insumos from '@/app/api/insumos/route'
import * as insumo from '@/app/api/insumos/[id]/route'
import * as movimentacoes from '@/app/api/insumos/[id]/movimentacoes/route'
import * as receitas from '@/app/api/receitas/route'
import * as receita from '@/app/api/receitas/[id]/route'
import { logarComo } from '../helpers/auth'
import { lerResposta, params, requisicao } from '../helpers/http'
import { criarCategoria, criarInsumo, criarReceita, criarUsuario, decimal } from '../helpers/db'

const CNPJ_VALIDO = '11.222.333/0001-81'

describe('rotas exigem login', () => {
  it.each([
    ['GET /categorias', () => categorias.GET(requisicao('GET', '/api/categorias'))],
    ['POST /fornecedores', () => fornecedores.POST(requisicao('POST', '/api/fornecedores', { nome: 'X' }))],
    ['GET /insumos', () => insumos.GET(requisicao('GET', '/api/insumos'))],
    ['GET /receitas', () => receitas.GET()],
    ['POST /insumos/:id/movimentacoes', () => movimentacoes.POST(requisicao('POST', '/x', {}), params({ id: 'x' }))],
  ])('%s sem sessão → 401', async (_nome, chamar) => {
    logarComo(null)
    expect((await chamar()).status).toBe(401)
  })
})

describe('categorias', () => {
  it('cria, recusa nome vazio e nome repetido, e lista só as ativas por padrão', async () => {
    logarComo('OPERADOR')
    expect(await lerResposta(await categorias.POST(requisicao('POST', '/api/categorias', { nome: '  Farinhas ', descricao: '' }))))
      .toMatchObject({ status: 201, json: { nome: 'Farinhas', descricao: null } })
    expect((await categorias.POST(requisicao('POST', '/api/categorias', { nome: ' ' }))).status).toBe(400)
    expect((await categorias.POST(requisicao('POST', '/api/categorias', { nome: 'Farinhas' }))).status).toBe(409)

    await prisma.categoria.create({ data: { nome: 'Antiga', ativo: false } })
    const ativas = await lerResposta(await categorias.GET(requisicao('GET', '/api/categorias')))
    expect(ativas.json.map((c: { nome: string }) => c.nome)).toEqual(['Farinhas'])
    const todas = await lerResposta(await categorias.GET(requisicao('GET', '/api/categorias?incluirInativas=true')))
    expect(todas.json).toHaveLength(2)
  })

  it('edita o nome; só o ADMIN ativa ou inativa', async () => {
    const c = await criarCategoria('Laticínios')
    await criarCategoria('Embutidos')
    logarComo('OPERADOR')
    expect((await categoria.PUT(requisicao('PUT', '/x', { nome: 'Queijos' }), params({ id: c.id }))).status).toBe(200)
    expect((await categoria.PUT(requisicao('PUT', '/x', { nome: 'Embutidos' }), params({ id: c.id }))).status).toBe(409)
    expect((await categoria.PUT(requisicao('PUT', '/x', { nome: '' }), params({ id: c.id }))).status).toBe(400)
    expect((await categoria.PUT(requisicao('PUT', '/x', { nome: 'Queijos', ativo: false }), params({ id: c.id }))).status).toBe(403)
    expect((await categoria.DELETE(requisicao('DELETE', '/x'), params({ id: c.id }))).status).toBe(403)

    logarComo('ADMIN')
    expect((await categoria.DELETE(requisicao('DELETE', '/x'), params({ id: c.id }))).status).toBe(200)
    expect((await prisma.categoria.findUniqueOrThrow({ where: { id: c.id } })).ativo).toBe(false)
    expect((await categoria.PATCH(requisicao('PATCH', '/x'), params({ id: c.id }))).status).toBe(200)
    expect((await prisma.categoria.findUniqueOrThrow({ where: { id: c.id } })).ativo).toBe(true)
  })

  it('não inativa categoria com insumos ativos', async () => {
    const c = await criarCategoria()
    await criarInsumo({ categoriaId: c.id })
    logarComo('ADMIN')
    expect(await lerResposta(await categoria.DELETE(requisicao('DELETE', '/x'), params({ id: c.id }))))
      .toEqual({ status: 409, json: { error: 'Categoria possui insumos ativos vinculados' } })
  })
})

describe('fornecedores', () => {
  it('valida os dígitos do CNPJ, guarda só os números e não aceita CNPJ repetido', async () => {
    logarComo('OPERADOR')
    expect(await lerResposta(await fornecedores.POST(requisicao('POST', '/api/fornecedores', { nome: 'Moinho', cnpj: '11.222.333/0001-82' }))))
      .toEqual({ status: 400, json: { error: 'CNPJ inválido' } })
    expect((await fornecedores.POST(requisicao('POST', '/api/fornecedores', { nome: 'X', cnpj: '11111111111111' }))).status).toBe(400)
    expect((await fornecedores.POST(requisicao('POST', '/api/fornecedores', { nome: '' }))).status).toBe(400)

    const criado = await lerResposta(await fornecedores.POST(requisicao('POST', '/api/fornecedores', { nome: 'Moinho Italiano', cnpj: CNPJ_VALIDO, email: ' a@b.com ' })))
    expect(criado).toMatchObject({ status: 201, json: { cnpj: '11222333000181', email: 'a@b.com' } })
    expect((await fornecedores.POST(requisicao('POST', '/api/fornecedores', { nome: 'Outro', cnpj: '11222333000181' }))).status).toBe(409)

    const busca = await lerResposta(await fornecedores.GET(requisicao('GET', '/api/fornecedores?busca=Moinho')))
    expect(busca.json).toHaveLength(1)
  })

  it('consulta, edita e só o ADMIN inativa', async () => {
    logarComo('OPERADOR')
    const f = await prisma.fornecedor.create({ data: { nome: 'Laticínios Serra' } })
    const outro = await prisma.fornecedor.create({ data: { nome: 'Outro', cnpj: '11222333000181' } })

    expect((await fornecedor.GET(requisicao('GET', '/x'), params({ id: f.id }))).status).toBe(200)
    expect((await fornecedor.GET(requisicao('GET', '/x'), params({ id: 'nao-existe' }))).status).toBe(404)
    expect((await fornecedor.PUT(requisicao('PUT', '/x', { nome: 'Serra', cnpj: CNPJ_VALIDO }), params({ id: f.id }))).status).toBe(409)
    expect((await fornecedor.PUT(requisicao('PUT', '/x', { nome: 'Serra', cnpj: '123' }), params({ id: f.id }))).status).toBe(400)
    expect((await fornecedor.PUT(requisicao('PUT', '/x', { nome: '' }), params({ id: f.id }))).status).toBe(400)
    expect((await fornecedor.PUT(requisicao('PUT', '/x', { nome: 'Serra', ativo: false }), params({ id: f.id }))).status).toBe(403)
    expect(await lerResposta(await fornecedor.PUT(requisicao('PUT', '/x', { nome: 'Serra', telefone: '47 9999' }), params({ id: f.id }))))
      .toMatchObject({ status: 200, json: { nome: 'Serra', telefone: '47 9999' } })
    expect((await fornecedor.DELETE(requisicao('DELETE', '/x'), params({ id: outro.id }))).status).toBe(403)

    logarComo('ADMIN')
    expect((await fornecedor.DELETE(requisicao('DELETE', '/x'), params({ id: outro.id }))).status).toBe(200)
    const inativos = await lerResposta(await fornecedores.GET(requisicao('GET', '/api/fornecedores?ativo=false')))
    expect(inativos.json).toHaveLength(2)
  })
})

describe('insumos e movimentações de estoque', () => {
  it('cria insumo validando campos e unidade, e sinaliza quem está abaixo do mínimo', async () => {
    const c = await criarCategoria()
    logarComo('OPERADOR')
    expect((await insumos.POST(requisicao('POST', '/api/insumos', { nome: 'Farinha', unidade: 'KG' }))).status).toBe(400)
    expect((await insumos.POST(requisicao('POST', '/api/insumos', { nome: 'Farinha', unidade: 'TONELADA', categoriaId: c.id }))).status).toBe(400)
    const criado = await lerResposta(await insumos.POST(requisicao('POST', '/api/insumos', { nome: 'Farinha 00', unidade: 'KG', categoriaId: c.id, estoqueMinimo: 5, precoUnitario: '8.5' })))
    expect(criado).toMatchObject({ status: 201, json: { nome: 'Farinha 00', estoqueMinimo: '5', precoUnitario: '8.5' } })
    await criarInsumo({ categoriaId: c.id, estoque: 10, minimo: 2 })

    const alerta = await lerResposta(await insumos.GET(requisicao('GET', `/api/insumos?alerta=true&categoriaId=${c.id}`)))
    expect(alerta.json.map((i: { nome: string; estoqueAbaixoMinimo: boolean }) => [i.nome, i.estoqueAbaixoMinimo])).toEqual([['Farinha 00', true]])
  })

  it('consulta e edita insumo; só o ADMIN inativa', async () => {
    const c = await criarCategoria()
    const i = await criarInsumo({ categoriaId: c.id, estoque: 1, minimo: 3 })
    logarComo('OPERADOR')
    expect(await lerResposta(await insumo.GET(requisicao('GET', '/x'), params({ id: i.id })))).toMatchObject({ status: 200, json: { estoqueAbaixoMinimo: true } })
    expect((await insumo.GET(requisicao('GET', '/x'), params({ id: 'nao-existe' }))).status).toBe(404)
    expect((await insumo.PUT(requisicao('PUT', '/x', { nome: 'X', unidade: 'KG', categoriaId: c.id, ativo: false }), params({ id: i.id }))).status).toBe(403)
    expect((await insumo.PUT(requisicao('PUT', '/x', { nome: '', unidade: 'KG', categoriaId: c.id }), params({ id: i.id }))).status).toBe(400)
    expect((await insumo.PUT(requisicao('PUT', '/x', { nome: 'X', unidade: 'BALDE', categoriaId: c.id }), params({ id: i.id }))).status).toBe(400)
    expect(await lerResposta(await insumo.PUT(requisicao('PUT', '/x', { nome: 'Mussarela', unidade: 'KG', categoriaId: c.id, estoqueMinimo: 0, precoUnitario: '' }), params({ id: i.id }))))
      .toMatchObject({ status: 200, json: { nome: 'Mussarela', precoUnitario: null } })
    expect((await insumo.DELETE(requisicao('DELETE', '/x'), params({ id: i.id }))).status).toBe(403)
    logarComo('ADMIN')
    expect((await insumo.DELETE(requisicao('DELETE', '/x'), params({ id: i.id }))).status).toBe(200)
  })

  it('entrada soma ao estoque e gera lote; saída maior que o saldo é recusada (422)', async () => {
    const u = await criarUsuario()
    const i = await criarInsumo({ nome: 'Farinha', estoque: 0 })
    logarComo('OPERADOR', u.id)
    const rota = (corpo: object) => movimentacoes.POST(requisicao('POST', '/x', corpo), params({ id: i.id }))

    const entrada = await lerResposta(await rota({ tipo: 'ENTRADA', quantidade: 25, precoUnitario: 8, dataVencimento: '2027-01-31' }))
    expect(entrada.status).toBe(201)
    expect(entrada.json.lote).toMatch(/^LOTE-\d{8}-[A-Z0-9]{4}$/)
    expect((await rota({ tipo: 'SAIDA', quantidade: 5, motivo: ' perda ' })).status).toBe(201)
    expect(await lerResposta(await rota({ tipo: 'SAIDA', quantidade: 100 })))
      .toEqual({ status: 422, json: { error: 'Saldo insuficiente de Farinha. Estoque atual: 20' } })
    expect(decimal((await prisma.insumo.findUniqueOrThrow({ where: { id: i.id } })).estoqueAtual)).toBe(20)

    expect((await rota({ tipo: 'ENTRADA' })).status).toBe(400)
    expect((await rota({ tipo: 'DOACAO', quantidade: 1 })).status).toBe(400)
    expect((await rota({ tipo: 'ENTRADA', quantidade: -1 })).status).toBe(400)
    expect((await movimentacoes.POST(requisicao('POST', '/x', { tipo: 'ENTRADA', quantidade: 1 }), params({ id: 'nao-existe' }))).status).toBe(404)
  })

  it('histórico traz o saldo acumulado após cada movimentação e aceita filtros', async () => {
    const u = await criarUsuario()
    const i = await criarInsumo()
    const mov = (tipo: 'ENTRADA' | 'SAIDA', quantidade: number, data: string) =>
      prisma.movimentacaoEstoque.create({ data: { tipo, quantidade, insumoId: i.id, usuarioId: u.id, createdAt: new Date(data) } })
    await mov('ENTRADA', 10, '2026-11-01T12:00:00Z')
    await mov('SAIDA', 3, '2026-11-05T12:00:00Z')
    await mov('ENTRADA', 2, '2026-11-10T12:00:00Z')

    logarComo('OPERADOR', u.id)
    const todas = await lerResposta(await movimentacoes.GET(requisicao('GET', '/x'), params({ id: i.id })))
    expect(todas.json.map((m: { saldoApos: string }) => m.saldoApos)).toEqual(['9.000', '7.000', '10.000']) // mais recente primeiro

    const saidas = await lerResposta(await movimentacoes.GET(requisicao('GET', '/x?tipo=SAIDA'), params({ id: i.id })))
    expect(saidas.json).toHaveLength(1)
    const periodo = await lerResposta(await movimentacoes.GET(requisicao('GET', '/x?dataInicio=2026-11-04&dataFim=2026-11-06'), params({ id: i.id })))
    expect(periodo.json.map((m: { saldoApos: string }) => m.saldoApos)).toEqual(['7.000'])
  })
})

describe('receitas (fichas técnicas)', () => {
  it('cria com ingredientes, validando nome, rendimento, preço e ingredientes', async () => {
    const farinha = await criarInsumo()
    logarComo('OPERADOR')
    const rota = (corpo: object) => receitas.POST(requisicao('POST', '/api/receitas', corpo))
    expect((await rota({ nome: '', rendimento: 1, insumos: [] })).status).toBe(400)
    expect((await rota({ nome: 'M', rendimento: 0, insumos: [] })).status).toBe(400)
    expect((await rota({ nome: 'M', rendimento: 1, precoVenda: -5, insumos: [{ insumoId: farinha.id, quantidade: 1 }] })).status).toBe(400)
    expect((await rota({ nome: 'M', rendimento: 1, insumos: [] })).status).toBe(400)

    const criada = await lerResposta(await rota({ nome: ' Margherita ', rendimento: 10, precoVenda: 42, insumos: [{ insumoId: farinha.id, quantidade: 0.25 }] }))
    expect(criada).toMatchObject({ status: 201, json: { nome: 'Margherita', precoVenda: '42', insumos: [{ quantidade: '0.25' }] } })
    const lista = await lerResposta(await receitas.GET())
    expect(lista.json).toHaveLength(1)
  })

  it('edita trocando os ingredientes; só o ADMIN inativa, e não se houver ordens', async () => {
    const [farinha, queijo] = [await criarInsumo(), await criarInsumo()]
    const r = await criarReceita({ ingredientes: [{ insumoId: farinha.id, quantidade: 1 }] })
    logarComo('OPERADOR')
    expect((await receita.GET(requisicao('GET', '/x'), params({ id: 'nao-existe' }))).status).toBe(404)
    expect((await receita.PUT(requisicao('PUT', '/x', { nome: '', rendimento: 1, insumos: [] }), params({ id: r.id }))).status).toBe(400)
    expect((await receita.PUT(requisicao('PUT', '/x', { nome: 'X', rendimento: -1, insumos: [] }), params({ id: r.id }))).status).toBe(400)
    expect((await receita.PUT(requisicao('PUT', '/x', { nome: 'X', rendimento: 1, precoVenda: 'abc', insumos: [] }), params({ id: r.id }))).status).toBe(400)
    expect((await receita.PUT(requisicao('PUT', '/x', { nome: 'X', rendimento: 1, insumos: [] }), params({ id: r.id }))).status).toBe(400)
    const editada = await lerResposta(await receita.PUT(requisicao('PUT', '/x', { nome: 'Quattro', rendimento: 8, precoVenda: '', insumos: [{ insumoId: queijo.id, quantidade: 2 }] }), params({ id: r.id })))
    expect(editada.json.insumos.map((i: { insumoId: string }) => i.insumoId)).toEqual([queijo.id])
    expect(editada.json.precoVenda).toBeNull()
    expect((await receita.GET(requisicao('GET', '/x'), params({ id: r.id }))).status).toBe(200)
    expect((await receita.DELETE(requisicao('DELETE', '/x'), params({ id: r.id }))).status).toBe(403)

    const u = await criarUsuario()
    await prisma.ordemProducao.create({ data: { usuarioId: u.id, receitas: { create: [{ receitaId: r.id, quantidade: 1 }] } } })
    logarComo('ADMIN')
    expect((await receita.DELETE(requisicao('DELETE', '/x'), params({ id: r.id }))).status).toBe(409)
    const livre = await criarReceita()
    expect((await receita.DELETE(requisicao('DELETE', '/x'), params({ id: livre.id }))).status).toBe(200)
  })
})
