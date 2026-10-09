import { NextResponse } from 'next/server'
import { exigirSessao } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await exigirSessao()
  if (session instanceof NextResponse) return session

  const receitas = await prisma.receita.findMany({
    where: { ativo: true },
    orderBy: { nome: 'asc' },
    include: {
      insumos: { include: { insumo: { select: { id: true, nome: true, unidade: true, estoqueAtual: true } } } },
      _count: { select: { ordens: true } },
    },
  })

  return NextResponse.json(receitas)
}

export async function POST(req: Request) {
  const session = await exigirSessao()
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { nome, descricao, rendimento, precoVenda, insumos } = body

  if (!nome?.trim()) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
  if (!rendimento || Number(rendimento) <= 0) return NextResponse.json({ error: 'Rendimento deve ser maior que zero' }, { status: 400 })
  if (precoVenda !== undefined && precoVenda !== null && precoVenda !== '' && !(Number(precoVenda) > 0)) {
    return NextResponse.json({ error: 'Preço de venda deve ser maior que zero' }, { status: 400 })
  }
  if (!Array.isArray(insumos) || insumos.length === 0) return NextResponse.json({ error: 'Adicione ao menos um insumo à receita' }, { status: 400 })

  const receita = await prisma.receita.create({
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
    include: {
      insumos: { include: { insumo: true } },
    },
  })

  return NextResponse.json(receita, { status: 201 })
}
