import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { nome, descricao } = body

  if (!nome?.trim()) {
    return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
  }

  const existe = await prisma.categoria.findFirst({
    where: { nome: nome.trim(), NOT: { id: params.id } },
  })
  if (existe) {
    return NextResponse.json({ error: 'Já existe uma categoria com este nome' }, { status: 409 })
  }

  const categoria = await prisma.categoria.update({
    where: { id: params.id },
    data: { nome: nome.trim(), descricao: descricao?.trim() || null },
  })

  return NextResponse.json(categoria)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const emUso = await prisma.insumo.findFirst({ where: { categoriaId: params.id } })
  if (emUso) {
    return NextResponse.json({ error: 'Categoria possui insumos vinculados' }, { status: 409 })
  }

  await prisma.categoria.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
