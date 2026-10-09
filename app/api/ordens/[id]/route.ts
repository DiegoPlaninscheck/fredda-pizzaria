import { NextResponse } from 'next/server'
import { exigirSessao } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { cancelarOrdem, concluirOrdem, OrdemFinalizadaError } from '@/lib/ordens'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await exigirSessao()
  if (session instanceof NextResponse) return session

  const ordem = await prisma.ordemProducao.findUnique({
    where: { id: params.id },
    include: {
      receitas: {
        include: {
          receita: {
            include: {
              insumos: { include: { insumo: { select: { id: true, nome: true, unidade: true } } } },
            },
          },
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
  const session = await exigirSessao()
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { status } = body

  if (!['CANCELADA', 'CONCLUIDA'].includes(status)) {
    return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
  }

  const atual = await prisma.ordemProducao.findUnique({ where: { id: params.id } })
  if (!atual) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })

  try {
    const ordem = await prisma.$transaction(async (tx) => {
      if (status === 'CONCLUIDA') await concluirOrdem(tx, params.id)
      else await cancelarOrdem(tx, params.id, session.user.id)
      return tx.ordemProducao.findUniqueOrThrow({ where: { id: params.id } })
    })
    return NextResponse.json(ordem)
  } catch (e) {
    if (e instanceof OrdemFinalizadaError) {
      return NextResponse.json({ error: e.message }, { status: 409 })
    }
    throw e
  }
}
