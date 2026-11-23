/**
 * Cliente do microsserviço de previsão de demanda (pasta ia/, FastAPI).
 * Configurado por IA_URL e IA_API_KEY; a chave vai no cabeçalho X-API-Key e nunca chega ao navegador.
 */
import { metricas } from '@/lib/metricas'

export interface ItemPrevisaoIA {
  semana: string
  sabor: string
  previsao: number
  limite_inferior: number
  limite_superior: number
  metodo: string
}

export interface RespostaPrevisaoIA {
  modelo_ativo: string
  nivel_confianca: number
  treinado_em: string | null
  ultima_semana_historico: string | null
  previsoes: ItemPrevisaoIA[]
}

export class IAIndisponivelError extends Error {}

async function chamar<T>(caminho: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const url = process.env.IA_URL
  const chave = process.env.IA_API_KEY
  const contar = (resultado: string) => metricas.previsaoRequisicoes.inc({ rota: caminho, resultado })

  if (!url || !chave) {
    contar('nao_configurado')
    throw new IAIndisponivelError('Microsserviço de previsão não configurado (defina IA_URL e IA_API_KEY).')
  }

  let res: Response
  try {
    res = await fetch(`${url.replace(/\/$/, '')}${caminho}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', 'X-API-Key': chave, ...init.headers },
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch {
    contar('sem_resposta')
    throw new IAIndisponivelError('O microsserviço de previsão não respondeu.')
  }

  if (!res.ok) {
    contar(`http_${res.status}`)
    const corpo = await res.json().catch(() => null)
    const detalhe = typeof corpo?.detail === 'string' ? corpo.detail : `HTTP ${res.status}`
    throw new IAIndisponivelError(`Erro no microsserviço de previsão: ${detalhe}`)
  }
  contar('ok')
  return res.json() as Promise<T>
}

/** Prevê `semanas` semanas após a semana que termina em `ate` (domingo, 'YYYY-MM-DD'). */
export function preverDemanda(semanas: number, ate: string) {
  return chamar<RespostaPrevisaoIA>('/previsao', {
    method: 'POST',
    body: JSON.stringify({ semanas, ate }),
  }, 20_000)
}

export function infoModelo() {
  return chamar<Record<string, unknown>>('/modelo', { method: 'GET' }, 10_000)
}

/** Retreina com o histórico do banco (pode levar alguns minutos). */
export function treinarModelo() {
  return chamar<Record<string, unknown>>('/treinar', { method: 'POST', body: '{}' }, 10 * 60_000)
}
