import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { MAX_SEMANAS_A_FRENTE, compararPlanos, gerarSugestao, semanasPlanejaveis } from '@/lib/planejamento'
import { IAIndisponivelError, infoModelo, preverDemanda, treinarModelo } from '@/lib/ia'
import { criarReceita, criarUsuario } from '../helpers/db'
import { simularFetch } from '../helpers/fetch'

// "Agora" fixo: quarta, 25/11/2026. Semana atual = 23/11; última completa = 16/11.
const AGORA = new Date('2026-11-25T15:00:00Z')

const prev = (sabor: string, semana: string, previsao: number, inf = previsao, sup = previsao) => ({
  semana, sabor, previsao, limite_inferior: inf, limite_superior: sup, metodo: 'hist_gradient_boosting_poisson',
})

describe('semanas planejáveis', () => {
  it('vão da próxima semana até 7 semanas à frente', () => {
    expect(semanasPlanejaveis(AGORA)).toEqual({ primeira: '2026-11-30', ultima: '2027-01-11' })
    expect(MAX_SEMANAS_A_FRENTE).toBe(7)
  })
})

describe('sugestão de produção', () => {
  async function cenario() {
    const usuario = await criarUsuario()
    const margherita = await criarReceita({ nome: 'Margherita', estoque: 10 })
    const calabrese = await criarReceita({ nome: 'Calabrese', estoque: 15 })
    const nova = await criarReceita({ nome: 'Nova (sem histórico)', estoque: 2 })
    await criarReceita({ nome: 'Antiga', ativo: false })

    // 6 margheritas em produção (ordem aberta); a ordem concluída não conta, já virou estoque
    await prisma.ordemProducao.create({
      data: { usuarioId: usuario.id, status: 'EM_ANDAMENTO', receitas: { create: [{ receitaId: margherita.id, quantidade: 6 }] } },
    })
    await prisma.ordemProducao.create({
      data: { usuarioId: usuario.id, status: 'CONCLUIDA', receitas: { create: [{ receitaId: margherita.id, quantidade: 100 }] } },
    })
    // 4 margheritas já vendidas nesta semana (saíram do estoque)
    await prisma.venda.create({
      data: { cliente: 'X', quantidade: 4, precoUnitario: 42, valorTotal: 168, receitaId: margherita.id, usuarioId: usuario.id, dataVenda: new Date('2026-11-24T18:00:00Z') },
    })
    return { margherita, calabrese, nova }
  }

  it('desconta do estoque projetado o que ainda vai vender até a semana planejada', async () => {
    const { margherita, calabrese, nova } = await cenario()
    const chamadas = simularFetch({
      json: {
        modelo_ativo: 'hist_gradient_boosting_poisson', nivel_confianca: 0.8, treinado_em: '2026-11-20T10:00:00Z',
        previsoes: [
          prev('MARGHERITA', '2026-11-23', 12), prev('margherita', '2026-11-30', 15), prev('Margherita', '2026-12-07', 20, 14, 27),
          prev('Calabrese', '2026-11-23', 5), prev('Calabrese', '2026-11-30', 5), prev('Calabrese', '2026-12-07', 8.4, 5, 11.2),
        ],
      },
    })

    const s = await gerarSugestao('2026-12-07', AGORA)

    // Pede ao serviço 3 semanas a partir do domingo da última semana completa
    expect(chamadas[0].url).toBe('http://ia.teste/previsao')
    expect(chamadas[0].corpo).toEqual({ semanas: 3, ate: '2026-11-22' })
    expect(chamadas[0].cabecalhos['x-api-key']).toBe('chave-ia-dos-testes')

    expect(s).toMatchObject({ semana: '2026-12-07', iaDisponivel: true, aviso: null, modeloAtivo: 'hist_gradient_boosting_poisson', nivelConfianca: 0.8 })
    expect(s.itens.map((i) => i.nome)).toEqual(['Calabrese', 'Margherita', 'Nova (sem histórico)']) // inativa fica de fora

    // Margherita: falta vender 12−4=8 nesta semana + 15 na próxima = 23; 10+6−23 < 0 → projetado 0
    expect(s.itens.find((i) => i.receitaId === margherita.id)).toMatchObject({
      estoqueAtual: 10, emProducao: 6, demandaAteLa: 23, estoqueProjetado: 0,
      previsao: 20, limiteInferior: 14, limiteSuperior: 27, sugerido: 20, sugeridoSeguro: 27,
    })
    // Calabrese: 15 − (5+5) = 5 projetado → previsão 8,4 pede 4 (arredonda para cima); limite 11,2 pede 7
    expect(s.itens.find((i) => i.receitaId === calabrese.id)).toMatchObject({
      demandaAteLa: 10, estoqueProjetado: 5, sugerido: 4, sugeridoSeguro: 7,
    })
    // Sem previsão: nada sugerido, o plano é manual
    expect(s.itens.find((i) => i.receitaId === nova.id)).toMatchObject({ previsao: null, sugerido: 0, sugeridoSeguro: 0 })
  })

  it('com estoque de sobra não sugere produção negativa', async () => {
    await criarReceita({ nome: 'Margherita', estoque: 500 })
    simularFetch({ json: { modelo_ativo: 'baseline', nivel_confianca: 0.8, treinado_em: null, previsoes: [prev('Margherita', '2026-11-30', 30)] } })
    const s = await gerarSugestao('2026-11-30', AGORA)
    expect(s.itens[0]).toMatchObject({ sugerido: 0, sugeridoSeguro: 0 })
  })

  it('serviço de IA fora do ar: avisa e deixa o plano manual, sem quebrar a tela', async () => {
    await criarReceita({ nome: 'Margherita', estoque: 3 })
    simularFetch(new TypeError('fetch failed'))
    const s = await gerarSugestao('2026-11-30', AGORA)
    expect(s.iaDisponivel).toBe(false)
    expect(s.aviso).toBe('O microsserviço de previsão não respondeu. Preencha as quantidades manualmente.')
    expect(s.itens[0]).toMatchObject({ previsao: null, sugerido: 0, estoqueProjetado: 3 })
  })

  it('serviço responde sem previsões (sem histórico): avisa que ainda não dá para prever', async () => {
    await criarReceita({ nome: 'Margherita' })
    simularFetch({ json: { modelo_ativo: 'baseline', nivel_confianca: 0.8, treinado_em: null, previsoes: [] } })
    const s = await gerarSugestao('2026-11-30', AGORA)
    expect(s.iaDisponivel).toBe(true)
    expect(s.aviso).toMatch(/Ainda não há histórico de vendas/)
  })
})

describe('cliente do serviço de previsão', () => {
  const url = process.env.IA_URL
  afterEach(() => { process.env.IA_URL = url })

  it('sem IA_URL configurada não chama nada e lança IAIndisponivelError', async () => {
    delete process.env.IA_URL
    const chamadas = simularFetch()
    await expect(preverDemanda(1, '2026-11-22')).rejects.toThrow(/não configurado/)
    expect(chamadas).toHaveLength(0)
  })

  it('erro HTTP vira IAIndisponivelError com o detalhe devolvido pelo serviço', async () => {
    simularFetch({ status: 503, json: { detail: 'Não foi possível ler as vendas do banco: OperationalError' } })
    const erro = await infoModelo().catch((e) => e)
    expect(erro).toBeInstanceOf(IAIndisponivelError)
    expect(erro.message).toBe('Erro no microsserviço de previsão: Não foi possível ler as vendas do banco: OperationalError')
  })

  it('erro HTTP sem detalhe mostra o código', async () => {
    simularFetch({ status: 500, texto: 'Internal Server Error' })
    await expect(treinarModelo()).rejects.toThrow('Erro no microsserviço de previsão: HTTP 500')
  })

  it('retreinar chama POST /treinar com a chave', async () => {
    const chamadas = simularFetch({ json: { modelo_ativo: 'baseline_media_movel_4' } })
    await expect(treinarModelo()).resolves.toEqual({ modelo_ativo: 'baseline_media_movel_4' })
    expect(chamadas[0]).toMatchObject({ url: 'http://ia.teste/treinar', metodo: 'POST' })
  })
})

describe('planejado × realizado', () => {
  it('compara previsão e plano com o que foi produzido e vendido em cada semana', async () => {
    const usuario = await criarUsuario()
    const margherita = await criarReceita({ nome: 'Margherita' })
    const calabrese = await criarReceita({ nome: 'Calabrese' })

    await prisma.planoProducao.create({
      data: {
        semana: new Date('2026-11-16T00:00:00Z'), modeloAtivo: 'baseline', usuarioId: usuario.id,
        itens: {
          create: [
            { receitaId: margherita.id, previsao: 10, limiteInferior: 7, limiteSuperior: 13, estoqueInicial: 0, sugerido: 10, planejado: 12 },
            { receitaId: calabrese.id, previsao: null, estoqueInicial: 0, sugerido: 0, planejado: 3 },
          ],
        },
      },
    })
    await prisma.planoProducao.create({
      data: { semana: new Date('2026-11-30T00:00:00Z'), usuarioId: usuario.id, itens: { create: [{ receitaId: margherita.id, estoqueInicial: 0, sugerido: 0, planejado: 5 }] } },
    })

    // Ordem concluída na quarta (18/11): conta como produção da semana de 16/11
    await prisma.ordemProducao.create({
      data: {
        usuarioId: usuario.id, status: 'CONCLUIDA',
        receitas: { create: [{ receitaId: margherita.id, quantidade: 12 }] },
        etapas: { create: [{ nome: 'CONGELAMENTO', ordem: 5, duracaoMinutos: 720, status: 'CONCLUIDA', concluidaEm: new Date('2026-11-18T20:00:00Z') }] },
      },
    })
    const venda = (quantidade: number, data: string) => prisma.venda.create({
      data: { cliente: 'X', quantidade, precoUnitario: 42, valorTotal: 42 * quantidade, receitaId: margherita.id, usuarioId: usuario.id, dataVenda: new Date(data) },
    })
    await venda(3, '2026-11-17T15:00:00Z')
    await venda(5, '2026-11-23T02:00:00Z') // domingo 23h em Brasília: ainda é a semana de 16/11
    await venda(9, '2026-11-23T04:00:00Z') // segunda 01h em Brasília: já é a semana seguinte

    const semanas = await compararPlanos(10, AGORA)

    expect(semanas.map((s) => [s.semana, s.situacao])).toEqual([['2026-11-30', 'futura'], ['2026-11-16', 'encerrada']])
    const encerrada = semanas[1]
    expect(encerrada.modeloAtivo).toBe('baseline')
    expect(encerrada.linhas).toEqual([
      { receitaId: calabrese.id, nome: 'Calabrese', previsao: null, limiteInferior: null, limiteSuperior: null, planejado: 3, produzido: 0, vendido: 0 },
      { receitaId: margherita.id, nome: 'Margherita', previsao: 10, limiteInferior: 7, limiteSuperior: 13, planejado: 12, produzido: 12, vendido: 8 },
    ])
  })

  it('sem planos salvos devolve lista vazia', async () => {
    expect(await compararPlanos(10, AGORA)).toEqual([])
  })
})
