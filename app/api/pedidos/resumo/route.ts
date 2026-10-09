import { NextResponse } from 'next/server'
import { exigirSessao } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'

/** Contadores para o badge da navegação lateral. */
export async function GET() {
  const session = await exigirSessao()
  if (session instanceof NextResponse) return session

  const [pendentes, conversasAguardando] = await Promise.all([
    prisma.pedido.count({ where: { status: 'PENDENTE' } }),
    prisma.conversa.count({ where: { status: 'HUMANO' } }),
  ])

  return NextResponse.json({ pendentes, conversasAguardando })
}
