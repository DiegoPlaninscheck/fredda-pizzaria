import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Params = { params: { id: string; etapaId: string } }

export async function GET(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const registros = await prisma.registroCondicoes.findMany({
    where: { etapaId: params.etapaId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(registros)
}

export async function POST(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { temperatura, umidade, observacoes } = body

  if (!temperatura && !umidade && !observacoes?.trim()) {
    return NextResponse.json({ error: 'Informe ao menos temperatura, umidade ou observação' }, { status: 400 })
  }

  const registro = await prisma.registroCondicoes.create({
    data: {
      etapaId: params.etapaId,
      temperatura: temperatura ? Number(temperatura) : null,
      umidade: umidade ? Number(umidade) : null,
      observacoes: observacoes?.trim() || null,
    },
  })

  return NextResponse.json(registro, { status: 201 })
}
