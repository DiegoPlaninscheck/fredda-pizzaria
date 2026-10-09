import { NextResponse } from 'next/server'
import { exigirSessao } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'

type Params = { params: { id: string; etapaId: string } }

export async function GET(_req: Request, { params }: Params) {
  const session = await exigirSessao()
  if (session instanceof NextResponse) return session

  const registros = await prisma.registroCondicoes.findMany({
    where: { etapaId: params.etapaId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(registros)
}

export async function POST(req: Request, { params }: Params) {
  const session = await exigirSessao()
  if (session instanceof NextResponse) return session

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
