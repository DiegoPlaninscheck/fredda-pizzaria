import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const receita = await prisma.receita.findUnique({
    where: { id: params.id },
    include: {
      insumos: {
        include: { insumo: { select: { id: true, nome: true, unidade: true, estoqueAtual: true } } },
      },
    },
  })
  if (!receita) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  return NextResponse.json(receita)
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { nome, descricao, rendimento, insumos } = body

  if (!nome?.trim()) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
  if (!rendimento || Number(rendimento) <= 0) return NextResponse.json({ error: 'Rendimento inválido' }, { status: 400 })
  if (!Array.isArray(insumos) || insumos.length === 0) return NextResponse.json({ error: 'Adicione ao menos um insumo' }, { status: 400 })

  const receita = await prisma.$transaction(async (tx) => {
    await tx.receitaInsumo.deleteMany({ where: { receitaId: params.id } })
    return tx.receita.update({
      where: { id: params.id },
      data: {
        nome: nome.trim(),
        descricao: descricao?.trim() || null,
        rendimento: Number(rendimento),
        insumos: {
          create: insumos.map((i: { insumoId: string; quantidade: number }) => ({
            insumoId: i.insumoId,
            quantidade: Number(i.quantidade),
          })),
        },
      },
      include: { insumos: { include: { insumo: true } } },
    })
  })

  return NextResponse.json(receita)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const emUso = await prisma.ordemProducao.findFirst({ where: { receitaId: params.id } })
  if (emUso) return NextResponse.json({ error: 'Receita possui ordens vinculadas' }, { status: 409 })

  await prisma.receita.update({ where: { id: params.id }, data: { ativo: false } })
  return NextResponse.json({ ok: true })
}
