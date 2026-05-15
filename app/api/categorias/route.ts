import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const categorias = await prisma.categoria.findMany({
    orderBy: { nome: 'asc' },
    include: { _count: { select: { insumos: true } } },
  })

  return NextResponse.json(categorias)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { nome, descricao } = body

  if (!nome?.trim()) {
    return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
  }

  const existe = await prisma.categoria.findUnique({ where: { nome: nome.trim() } })
  if (existe) {
    return NextResponse.json({ error: 'Já existe uma categoria com este nome' }, { status: 409 })
  }

  const categoria = await prisma.categoria.create({
    data: { nome: nome.trim(), descricao: descricao?.trim() || null },
  })

  return NextResponse.json(categoria, { status: 201 })
}
