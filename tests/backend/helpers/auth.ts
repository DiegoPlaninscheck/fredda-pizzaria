import type { Session } from 'next-auth'

type Perfil = 'ADMIN' | 'OPERADOR'

let sessao: Session | null = null

/** Sessão devolvida pelo getServerSession simulado (ver tests/backend/setup.ts). */
export function sessaoAtual() {
  return sessao
}

/**
 * Define quem está "logado" nas próximas chamadas às rotas.
 * `null` = sem sessão. O `id` precisa ser de um usuário existente quando a rota grava
 * algo ligado ao usuário (vendas, movimentações, ordens).
 */
export function logarComo(perfil: Perfil | null, id = 'usuario-teste') {
  sessao = perfil
    ? ({ user: { id, nome: `Teste ${perfil}`, email: `${perfil.toLowerCase()}@teste.com`, role: perfil }, expires: '2999-01-01' } as unknown as Session)
    : null
}
