import { vi } from 'vitest'

export interface ChamadaFetch {
  url: string
  metodo: string
  cabecalhos: Record<string, string>
  corpo: any
}

type Resposta = { status?: number; json?: unknown; texto?: string } | Error

/**
 * Substitui o fetch global (WhatsApp, Twilio, serviço de IA) por uma função que
 * registra as chamadas e devolve as respostas definidas pelo teste, por ordem ou por URL.
 * Nenhum teste acessa a internet.
 */
export function simularFetch(responder: Resposta | ((url: string, init?: RequestInit) => Resposta) = { json: {} }) {
  const chamadas: ChamadaFetch[] = []
  const fn = vi.fn(async (entrada: string | URL | Request, init?: RequestInit) => {
    const url = String(entrada instanceof Request ? entrada.url : entrada)
    const cabecalhos = Object.fromEntries(new Headers(init?.headers).entries())
    let corpo: any = init?.body ?? null
    if (typeof corpo === 'string') {
      try { corpo = JSON.parse(corpo) } catch { /* corpo não é JSON (ex.: form da Twilio) */ }
    } else if (corpo instanceof URLSearchParams) {
      corpo = Object.fromEntries(corpo.entries())
    }
    chamadas.push({ url, metodo: init?.method ?? 'GET', cabecalhos, corpo })

    const r = typeof responder === 'function' ? responder(url, init) : responder
    if (r instanceof Error) throw r
    const texto = r.texto ?? JSON.stringify(r.json ?? {})
    return new Response(texto, { status: r.status ?? 200, headers: { 'content-type': 'application/json' } })
  })
  vi.stubGlobal('fetch', fn)
  return chamadas
}
