import { NextResponse } from 'next/server'
import { exigirSessao } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'

/** Conversas aguardando atendimento humano. */
export async function GET() {
  const session = await exigirSessao()
  if (session instanceof NextResponse) return session

  const conversas = await prisma.conversa.findMany({
    where: { status: 'HUMANO' },
    orderBy: { ultimaMensagemEm: 'desc' },
    select: {
      id: true,
      ultimaMensagemEm: true,
      cliente: { select: { nome: true, telefone: true } },
      mensagens: { orderBy: { createdAt: 'desc' }, take: 1, select: { texto: true, direcao: true } },
    },
  })

  return NextResponse.json(conversas)
}
