import { NextResponse } from 'next/server'
import { exigirSessao } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await exigirSessao()
  if (session instanceof NextResponse) return session

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
  const session = await exigirSessao()
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { nome, descricao, rendimento, precoVenda, insumos } = body

  if (!nome?.trim()) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
  if (!rendimento || Number(rendimento) <= 0) return NextResponse.json({ error: 'Rendimento inválido' }, { status: 400 })
  if (precoVenda !== undefined && precoVenda !== null && precoVenda !== '' && !(Number(precoVenda) > 0)) {
    return NextResponse.json({ error: 'Preço de venda deve ser maior que zero' }, { status: 400 })
  }
  if (!Array.isArray(insumos) || insumos.length === 0) return NextResponse.json({ error: 'Adicione ao menos um insumo' }, { status: 400 })

  const receita = await prisma.$transaction(async (tx) => {
    await tx.receitaInsumo.deleteMany({ where: { receitaId: params.id } })
    return tx.receita.update({
      where: { id: params.id },
      data: {
        nome: nome.trim(),
        descricao: descricao?.trim() || null,
        rendimento: Number(rendimento),
        precoVenda: precoVenda ? Number(precoVenda) : null,
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
  const session = await exigirSessao('ADMIN')
  if (session instanceof NextResponse) return session

  const emUso = await prisma.ordemReceita.findFirst({ where: { receitaId: params.id } })
  if (emUso) return NextResponse.json({ error: 'Receita possui ordens vinculadas' }, { status: 409 })

  await prisma.receita.update({ where: { id: params.id }, data: { ativo: false } })
  return NextResponse.json({ ok: true })
}
