import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * Exige sessão válida (e, opcionalmente, um perfil) nas rotas de API.
 * Retorna a sessão ou uma resposta de erro pronta para ser devolvida:
 *
 *   const session = await exigirSessao()
 *   if (session instanceof NextResponse) return session
 */
export async function exigirSessao(role?: 'ADMIN') {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  if (role && session.user.role !== role) {
    return NextResponse.json({ error: 'Apenas administradores podem realizar esta ação' }, { status: 403 })
  }

  return session
}
