import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NomeEtapa } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

const ETAPAS_PADRAO: { nome: NomeEtapa; ordem: number; duracaoMinutos: number }[] = [
  { nome: NomeEtapa.MISTURA,           ordem: 1, duracaoMinutos: 30   },
  { nome: NomeEtapa.DESCANSO_INICIAL,  ordem: 2, duracaoMinutos: 60   },
  { nome: NomeEtapa.FERMENTACAO_LONGA, ordem: 3, duracaoMinutos: 1440 },
  { nome: NomeEtapa.MODELAGEM,         ordem: 4, duracaoMinutos: 60   },
  { nome: NomeEtapa.CONGELAMENTO,      ordem: 5, duracaoMinutos: 720  },
]

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const receitaId = searchParams.get('receitaId')

  const ordens = await prisma.ordemProducao.findMany({
    where: {
      status: status ? (status as never) : { not: 'CANCELADA' },
      receitaId: receitaId || undefined,
    },
    orderBy: { createdAt: 'desc' },
    include: {
      receita: { select: { id: true, nome: true } },
      usuario: { select: { nome: true } },
      etapas: { orderBy: { ordem: 'asc' } },
    },
  })

  return NextResponse.json(ordens)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { receitaId, quantidade, dataPrevista, observacoes } = body

  if (!receitaId) return NextResponse.json({ error: 'Receita é obrigatória' }, { status: 400 })
  if (!quantidade || Number(quantidade) <= 0) return NextResponse.json({ error: 'Quantidade deve ser maior que zero' }, { status: 400 })

  const qtd = new Decimal(quantidade)

  // Verificar estoque dos insumos
  const receita = await prisma.receita.findUnique({
    where: { id: receitaId },
    include: { insumos: { include: { insumo: true } } },
  })
  if (!receita) return NextResponse.json({ error: 'Receita não encontrada' }, { status: 404 })

  const insuficientes = receita.insumos
    .map((ri) => {
      const necessario = new Decimal(ri.quantidade).mul(qtd)
      const disponivel = new Decimal(ri.insumo.estoqueAtual)
      return {
        nome: ri.insumo.nome,
        necessario: necessario.toFixed(3),
        disponivel: disponivel.toFixed(3),
        suficiente: disponivel.gte(necessario),
      }
    })
    .filter((i) => !i.suficiente)

  if (insuficientes.length > 0) {
    return NextResponse.json(
      { error: 'Estoque insuficiente para alguns insumos', insuficientes },
      { status: 422 }
    )
  }

  const ordem = await prisma.ordemProducao.create({
    data: {
      receitaId,
      usuarioId: session.user.id,
      quantidade: qtd,
      dataPrevista: dataPrevista ? new Date(dataPrevista) : null,
      observacoes: observacoes?.trim() || null,
      etapas: { create: ETAPAS_PADRAO },
    },
    include: {
      receita: { select: { id: true, nome: true } },
      usuario: { select: { nome: true } },
      etapas: { orderBy: { ordem: 'asc' } },
    },
  })

  return NextResponse.json(ordem, { status: 201 })
}
