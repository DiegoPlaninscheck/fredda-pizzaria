/** Monta uma Request para chamar o handler de uma rota diretamente, sem servidor HTTP. */
export function requisicao(metodo: string, caminho: string, corpo?: unknown, cabecalhos: Record<string, string> = {}) {
  const init: RequestInit = { method: metodo, headers: { ...cabecalhos } }
  if (corpo !== undefined) {
    init.body = typeof corpo === 'string' ? corpo : JSON.stringify(corpo)
    if (typeof corpo !== 'string') (init.headers as Record<string, string>)['content-type'] = 'application/json'
  }
  return new Request(`http://localhost${caminho}`, init)
}

/** Lê o status e o JSON de uma resposta de rota. */
export async function lerResposta(res: Response) {
  const texto = await res.text()
  let json: any = null
  try {
    json = texto ? JSON.parse(texto) : null
  } catch {
    json = texto
  }
  return { status: res.status, json }
}

/** Parâmetros de rota dinâmica, no formato que o Next passa para o handler. */
export const params = <T extends Record<string, string>>(p: T) => ({ params: p })
