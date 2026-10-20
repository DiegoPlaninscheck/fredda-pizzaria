import { prisma } from '@/lib/prisma'
import { STATUS_FINAIS } from '@/lib/ordens'
import { IAIndisponivelError, ItemPrevisaoIA, RespostaPrevisaoIA, preverDemanda } from '@/lib/ia'
import {
  adicionarDias, adicionarSemanas, dataParaSemana, intervaloUtc, segundaDaSemana, semanasEntre,
} from '@/lib/semanas'

/** Até quantas semanas à frente dá para planejar (limite do microsserviço). */
export const MAX_SEMANAS_A_FRENTE = 7

export interface ItemSugestao {
  receitaId: string
  nome: string
  estoqueAtual: number
  emProducao: number
  demandaAteLa: number
  estoqueProjetado: number
  previsao: number | null
  limiteInferior: number | null
  limiteSuperior: number | null
  metodo: string | null
  sugerido: number
  sugeridoSeguro: number
}

export interface Sugestao {
  semana: string
  iaDisponivel: boolean
  aviso: string | null
  modeloAtivo: string | null
  nivelConfianca: number | null
  treinadoEm: string | null
  itens: ItemSugestao[]
}

const chave = (nome: string) => nome.trim().toLocaleLowerCase('pt-BR')
const somar = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v)

/** Semanas que podem ser planejadas: da próxima semana até MAX_SEMANAS_A_FRENTE à frente. */
export function semanasPlanejaveis(agora = new Date()) {
  const atual = segundaDaSemana(agora)
  return { primeira: adicionarSemanas(atual, 1), ultima: adicionarSemanas(atual, MAX_SEMANAS_A_FRENTE) }
}

/**
 * Sugestão de produção para a semana `alvo`.
 *
 * Estoque projetado no início da semana = estoque atual + ordens em andamento
 * − demanda prevista até lá (o que falta vender na semana atual + semanas intermediárias).
 * Sugerido = previsão da semana − estoque projetado (arredondado para cima, nunca negativo);
 * a versão "segura" usa o limite superior do intervalo de previsão.
 */
export async function gerarSugestao(alvo: string, agora = new Date()): Promise<Sugestao> {
  const atual = segundaDaSemana(agora)
  const ultimaCompleta = adicionarSemanas(atual, -1)
  const horizonte = semanasEntre(ultimaCompleta, alvo)

  const [receitas, emAndamento, vendasSemana] = await Promise.all([
    prisma.receita.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } }),
    prisma.ordemReceita.groupBy({
      by: ['receitaId'],
      where: { ordem: { status: { notIn: STATUS_FINAIS } } },
      _sum: { quantidade: true },
    }),
    prisma.venda.groupBy({
      by: ['receitaId'],
      where: { dataVenda: { gte: intervaloUtc(atual).inicio } },
      _sum: { quantidade: true },
    }),
  ])

  const producao = new Map(emAndamento.map((g) => [g.receitaId, Number(g._sum.quantidade ?? 0)]))
  const vendidoAtual = new Map(vendasSemana.map((g) => [g.receitaId, Number(g._sum.quantidade ?? 0)]))

  let aviso: string | null = null
  let resposta: RespostaPrevisaoIA | null = null
  try {
    resposta = await preverDemanda(horizonte, adicionarDias(ultimaCompleta, 6))
  } catch (e) {
    if (!(e instanceof IAIndisponivelError)) throw e
    aviso = `${e.message} Preencha as quantidades manualmente.`
  }

  // Previsão por sabor e semana
  const previsoes = new Map<string, Map<string, ItemPrevisaoIA>>()
  for (const p of resposta?.previsoes ?? []) {
    const porSemana = previsoes.get(chave(p.sabor)) ?? new Map<string, ItemPrevisaoIA>()
    porSemana.set(p.semana, p)
    previsoes.set(chave(p.sabor), porSemana)
  }

  const itens: ItemSugestao[] = receitas.map((r) => {
    const porSemana = previsoes.get(chave(r.nome))
    const alvoPrev = porSemana?.get(alvo) ?? null

    const demanda = new Map<string, number>()
    if (porSemana) {
      for (let s = atual; s < alvo; s = adicionarSemanas(s, 1)) {
        const p = porSemana.get(s)
        if (!p) continue
        // Na semana atual, só o que ainda falta vender (o já vendido saiu do estoque)
        somar(demanda, r.id, s === atual ? Math.max(0, p.previsao - (vendidoAtual.get(r.id) ?? 0)) : p.previsao)
      }
    }

    const estoqueAtual = Number(r.estoqueAtual)
    const emProducao = producao.get(r.id) ?? 0
    const demandaAteLa = Math.round((demanda.get(r.id) ?? 0) * 100) / 100
    const estoqueProjetado = Math.max(0, Math.round((estoqueAtual + emProducao - demandaAteLa) * 100) / 100)
    const faltaPara = (meta: number | null) => (meta === null ? 0 : Math.max(0, Math.ceil(meta - estoqueProjetado)))

    return {
      receitaId: r.id,
      nome: r.nome,
      estoqueAtual,
      emProducao,
      demandaAteLa,
      estoqueProjetado,
      previsao: alvoPrev?.previsao ?? null,
      limiteInferior: alvoPrev?.limite_inferior ?? null,
      limiteSuperior: alvoPrev?.limite_superior ?? null,
      metodo: alvoPrev?.metodo ?? null,
      sugerido: faltaPara(alvoPrev?.previsao ?? null),
      sugeridoSeguro: faltaPara(alvoPrev?.limite_superior ?? null),
    }
  })

  if (resposta && !aviso && itens.every((i) => i.previsao === null)) {
    aviso = 'Ainda não há histórico de vendas para prever. Preencha as quantidades manualmente.'
  }

  return {
    semana: alvo,
    iaDisponivel: resposta !== null,
    aviso,
    modeloAtivo: resposta?.modelo_ativo ?? null,
    nivelConfianca: resposta?.nivel_confianca ?? null,
    treinadoEm: resposta?.treinado_em ?? null,
    itens,
  }
}

export interface LinhaComparacao {
  receitaId: string
  nome: string
  previsao: number | null
  limiteInferior: number | null
  limiteSuperior: number | null
  planejado: number
  produzido: number
  vendido: number
}

export interface SemanaComparacao {
  semana: string
  situacao: 'encerrada' | 'em_andamento' | 'futura'
  modeloAtivo: string | null
  linhas: LinhaComparacao[]
}

/** Planejado x realizado: previsão e plano salvos contra ordens concluídas e vendas de cada semana. */
export async function compararPlanos(limite: number, agora = new Date()): Promise<SemanaComparacao[]> {
  const planos = await prisma.planoProducao.findMany({
    orderBy: { semana: 'desc' },
    take: limite,
    include: { itens: { include: { receita: { select: { nome: true } } } } },
  })
  if (planos.length === 0) return []

  const semanas = planos.map((p) => dataParaSemana(p.semana))
  const inicio = intervaloUtc(semanas[semanas.length - 1]).inicio
  const fim = intervaloUtc(semanas[0]).fim

  const [ordens, vendas] = await Promise.all([
    // A conclusão grava concluidaEm nas etapas e atualiza a ordem, então updatedAt >= data de conclusão
    prisma.ordemProducao.findMany({
      where: { status: 'CONCLUIDA', updatedAt: { gte: inicio } },
      include: { receitas: true, etapas: { select: { concluidaEm: true } } },
    }),
    prisma.venda.findMany({
      where: { dataVenda: { gte: inicio, lt: fim } },
      select: { receitaId: true, quantidade: true, dataVenda: true },
    }),
  ])

  const produzido = new Map<string, number>()
  for (const o of ordens) {
    const datas = o.etapas.map((e) => e.concluidaEm?.getTime() ?? 0)
    const concluidaEm = new Date(Math.max(...datas, 0) || o.updatedAt.getTime())
    const semana = segundaDaSemana(concluidaEm)
    for (const r of o.receitas) somar(produzido, `${semana}|${r.receitaId}`, Number(r.quantidade))
  }
  const vendido = new Map<string, number>()
  for (const v of vendas) somar(vendido, `${segundaDaSemana(v.dataVenda)}|${v.receitaId}`, Number(v.quantidade))

  const atual = segundaDaSemana(agora)
  return planos.map((p) => {
    const semana = dataParaSemana(p.semana)
    return {
      semana,
      situacao: semana < atual ? 'encerrada' : semana === atual ? 'em_andamento' : 'futura',
      modeloAtivo: p.modeloAtivo,
      linhas: p.itens
        .map((i) => ({
          receitaId: i.receitaId,
          nome: i.receita.nome,
          previsao: i.previsao === null ? null : Number(i.previsao),
          limiteInferior: i.limiteInferior === null ? null : Number(i.limiteInferior),
          limiteSuperior: i.limiteSuperior === null ? null : Number(i.limiteSuperior),
          planejado: Number(i.planejado),
          produzido: produzido.get(`${semana}|${i.receitaId}`) ?? 0,
          vendido: vendido.get(`${semana}|${i.receitaId}`) ?? 0,
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    }
  })
}

