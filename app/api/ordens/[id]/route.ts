import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const ordem = await prisma.ordemProducao.findUnique({
    where: { id: params.id },
    include: {
      receita: {
        include: {
          insumos: { include: { insumo: { select: { id: true, nome: true, unidade: true } } } },
        },
      },
      usuario: { select: { nome: true } },
      etapas: {
        orderBy: { ordem: 'asc' },
        include: { registros: { orderBy: { createdAt: 'desc' } } },
      },
    },
  })

  if (!ordem) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  return NextResponse.json(ordem)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { status } = body

  if (!['CANCELADA', 'CONCLUIDA'].includes(status)) {
    return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
  }

  const ordem = await prisma.ordemProducao.update({
    where: { id: params.id },
    data: { status },
  })

  return NextResponse.json(ordem)
}
