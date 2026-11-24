import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import * as plano from '@/app/api/planejamento/route'
import * as sugestao from '@/app/api/planejamento/sugestao/route'
import * as comparacao from '@/app/api/planejamento/comparacao/route'
import * as modelo from '@/app/api/planejamento/modelo/route'
import * as health from '@/app/api/health/route'
import * as metrics from '@/app/api/metrics/route'
import { semanasPlanejaveis } from '@/lib/planejamento'
import { logarComo } from '../helpers/auth'
import { lerResposta, requisicao } from '../helpers/http'
import { simularFetch } from '../helpers/fetch'
import { criarReceita, criarUsuario } from '../helpers/db'

const ambiente = { ...process.env }
afterEach(() => { process.env = { ...ambiente } })

describe('plano de produção da semana', () => {
  it('salva, substitui e consulta o plano de uma segunda-feira', async () => {
    const u = await criarUsuario()
    const [a, b] = [await criarReceita({ nome: 'Margherita' }), await criarReceita({ nome: 'Calabrese' })]
    logarComo('OPERADOR', u.id)
    const salvar = (itens: object[]) => plano.PUT(requisicao('PUT', '/api/planejamento', { semana: '2026-11-30', modeloAtivo: 'baseline', observacoes: ' feriado ', itens }))

    const primeiro = await lerResposta(await salvar([
      { receitaId: a.id, previsao: 10, limiteInferior: 7, limiteSuperior: 13, metodo: 'baseline', estoqueInicial: 2, sugerido: 8, planejado: 9 },
      { receitaId: b.id, previsao: null, estoqueInicial: 0, sugerido: 0, planejado: 4 },
    ]))
    expect(primeiro.status).toBe(200)
    expect(primeiro.json).toMatchObject({ modeloAtivo: 'baseline', observacoes: 'feriado' })
    expect(primeiro.json.itens.map((i: { receita: { nome: string }; planejado: string }) => [i.receita.nome, i.planejado])).toEqual([['Calabrese', '4'], ['Margherita', '9']])

    await salvar([{ receitaId: a.id, estoqueInicial: 0, sugerido: 0, planejado: 20 }])
    expect(await prisma.planoProducao.count()).toBe(1)
    expect(await prisma.planoProducaoItem.count()).toBe(1)

    const consulta = await lerResposta(await plano.GET(requisicao('GET', '/api/planejamento?semana=2026-11-30')))
    expect(consulta.json.itens[0].planejado).toBe('20')
    expect((await lerResposta(await plano.GET(requisicao('GET', '/api/planejamento?semana=2026-12-07')))).json).toBeNull()
  })

  it.each([
    [{ semana: '2026-12-01', itens: [{}] }, 'Semana inválida (use a data de uma segunda-feira)'],
    [{ semana: '2026-11-30', itens: [] }, 'O plano precisa de ao menos um sabor'],
    [{ semana: '2026-11-30', itens: [{ planejado: 1 }] }, 'Receita é obrigatória em cada item'],
    [{ semana: '2026-11-30', itens: [{ receitaId: 'a', planejado: 1, sugerido: 0, estoqueInicial: 0 }, { receitaId: 'a', planejado: 1, sugerido: 0, estoqueInicial: 0 }] }, 'Cada sabor deve aparecer apenas uma vez'],
    [{ semana: '2026-11-30', itens: [{ receitaId: 'a', planejado: -1, sugerido: 0, estoqueInicial: 0 }] }, 'Quantidades devem ser números maiores ou iguais a zero'],
    [{ semana: '2026-11-30', itens: [{ receitaId: 'a', planejado: 1, sugerido: 0, estoqueInicial: 0, previsao: -3 }] }, 'Previsão inválida'],
  ])('valida a entrada (%j)', async (corpo, erro) => {
    logarComo('OPERADOR')
    expect(await lerResposta(await plano.PUT(requisicao('PUT', '/api/planejamento', corpo)))).toEqual({ status: 400, json: { error: erro } })
  })

  it('receita inexistente → 404; GET sem semana válida → 400', async () => {
    logarComo('OPERADOR')
    expect((await plano.PUT(requisicao('PUT', '/api/planejamento', { semana: '2026-11-30', itens: [{ receitaId: 'nao-existe', planejado: 1, sugerido: 0, estoqueInicial: 0 }] }))).status).toBe(404)
    expect((await plano.GET(requisicao('GET', '/api/planejamento'))).status).toBe(400)
  })
})

describe('sugestão, comparação e modelo', () => {
  it('sugestão só para semanas planejáveis (da próxima até 7 à frente)', async () => {
    logarComo('OPERADOR')
    await criarReceita({ nome: 'Margherita' })
    simularFetch({ json: { modelo_ativo: 'baseline', nivel_confianca: 0.8, treinado_em: null, previsoes: [] } })
    const { primeira } = semanasPlanejaveis()

    const padrao = await lerResposta(await sugestao.GET(requisicao('GET', '/api/planejamento/sugestao')))
    expect(padrao).toMatchObject({ status: 200, json: { semana: primeira, iaDisponivel: true } })
    expect((await sugestao.GET(requisicao('GET', '/api/planejamento/sugestao?semana=2020-01-06'))).status).toBe(400)
    expect((await sugestao.GET(requisicao('GET', '/api/planejamento/sugestao?semana=2026-11-24'))).status).toBe(400) // terça
  })

  it('comparação limita a quantidade de semanas', async () => {
    logarComo('OPERADOR')
    expect((await lerResposta(await comparacao.GET(requisicao('GET', '/api/planejamento/comparacao?limite=999')))).json).toEqual([])
  })

  it('consultar o modelo é para todos; retreinar só o ADMIN; serviço fora → 503', async () => {
    logarComo('OPERADOR')
    simularFetch({ json: { modelo_ativo: 'baseline_media_movel_4' } })
    expect((await lerResposta(await modelo.GET())).json).toEqual({ modelo_ativo: 'baseline_media_movel_4' })
    expect((await modelo.POST()).status).toBe(403)

    logarComo('ADMIN')
    expect((await modelo.POST()).status).toBe(200)
    simularFetch(new TypeError('fetch failed'))
    expect(await lerResposta(await modelo.POST())).toEqual({ status: 503, json: { error: 'O microsserviço de previsão não respondeu.' } })
    expect((await modelo.GET()).status).toBe(503)
  })
})

describe('rotas operacionais', () => {
  it('health check responde ok com o banco no ar', async () => {
    expect(await lerResposta(await health.GET())).toEqual({ status: 200, json: { status: 'ok', db: 'ok' } })
  })

  it('métricas exigem o token; sem token configurado a rota não existe', async () => {
    await criarReceita()
    const semToken = await metrics.GET(requisicao('GET', '/api/metrics'))
    expect(semToken.status).toBe(401)
    expect((await metrics.GET(requisicao('GET', '/api/metrics', undefined, { authorization: 'Bearer errado' }))).status).toBe(401)

    const ok = await metrics.GET(requisicao('GET', '/api/metrics', undefined, { authorization: 'Bearer token-dos-testes' }))
    expect(ok.status).toBe(200)
    const texto = await ok.text()
    expect(texto).toMatch(/^fredda_pedidos_pendentes\{app="fredda-app"\} 0$/m)
    expect(texto).toMatch(/^fredda_insumos_abaixo_minimo\{app="fredda-app"\} 0$/m)
    expect(texto).toContain('fredda_node_process_resident_memory_bytes')

    process.env.METRICS_TOKEN = ''
    expect((await metrics.GET(requisicao('GET', '/api/metrics', undefined, { authorization: 'Bearer ' }))).status).toBe(404)
  })
})
