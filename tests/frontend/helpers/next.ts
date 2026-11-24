import { vi } from 'vitest'

/**
 * Estado controlado pelos testes para os módulos do Next e do NextAuth, que são
 * simulados em tests/frontend/setup.ts (no navegador real eles dependem do servidor).
 */
export const roteador = { push: vi.fn(), refresh: vi.fn(), back: vi.fn(), replace: vi.fn() }

export const navegacao = {
  caminho: '/dashboard',
  params: {} as Record<string, string>,
  busca: new URLSearchParams(),
}

export const autenticacao = {
  sessao: { user: { id: 'u1', name: 'Diego Planinscheck', email: 'diego@fredda.com', role: 'ADMIN' as 'ADMIN' | 'OPERADOR' }, expires: '2999-01-01' } as null | {
    user: { id: string; name: string; email: string; role: 'ADMIN' | 'OPERADOR' }
    expires: string
  },
  signIn: vi.fn(),
  signOut: vi.fn(),
}

export function logarComo(role: 'ADMIN' | 'OPERADOR') {
  autenticacao.sessao = { user: { id: 'u1', name: 'Diego Planinscheck', email: 'diego@fredda.com', role }, expires: '2999-01-01' }
}

/** Resposta JSON para o fetch simulado das telas. */
export const json = (corpo: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } }))

/**
 * Substitui o fetch do navegador: `rotas` mapeia "MÉTODO caminho" (ou só o caminho, para GET)
 * para a resposta. Devolve a lista de chamadas feitas pela tela.
 */
export function simularApi(rotas: Record<string, unknown | ((corpo: any) => unknown)>) {
  const chamadas: { metodo: string; url: string; corpo: any }[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const metodo = init?.method ?? 'GET'
    const corpo = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    chamadas.push({ metodo, url, corpo })
    const caminho = url.split('?')[0]
    const chave = [`${metodo} ${url}`, `${metodo} ${caminho}`, metodo === 'GET' ? url : '', metodo === 'GET' ? caminho : '']
      .find((k) => k && k in rotas)
    if (!chave) return json({ error: `rota não simulada: ${metodo} ${url}` }, 404)
    const r = rotas[chave]
    const valor = typeof r === 'function' ? (r as (c: unknown) => unknown)(corpo) : r
    if (valor && typeof valor === 'object' && '__status' in (valor as object)) {
      const { __status, ...resto } = valor as { __status: number }
      return json(resto, __status)
    }
    return json(valor)
  }))
  return chamadas
}

/** Resposta de erro para simularApi: `erro(400, 'mensagem')`. */
export const erro = (status: number, mensagem: string) => ({ __status: status, error: mensagem })
