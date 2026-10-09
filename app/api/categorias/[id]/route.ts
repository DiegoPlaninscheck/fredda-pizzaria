import { NextResponse } from 'next/server'
import { exigirSessao } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await exigirSessao()
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { nome, descricao, ativo } = body

  if (ativo !== undefined && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Apenas administradores podem ativar ou inativar categorias' }, { status: 403 })
  }

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
    data: {
      nome: nome.trim(),
      descricao: descricao?.trim() || null,
      ativo: ativo !== undefined ? Boolean(ativo) : undefined,
    },
  })

  return NextResponse.json(categoria)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await exigirSessao('ADMIN')
  if (session instanceof NextResponse) return session

  const emUso = await prisma.insumo.findFirst({ where: { categoriaId: params.id, ativo: true } })
  if (emUso) {
    return NextResponse.json({ error: 'Categoria possui insumos ativos vinculados' }, { status: 409 })
  }

  await prisma.categoria.update({ where: { id: params.id }, data: { ativo: false } })
  return NextResponse.json({ ok: true })
}

export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  const session = await exigirSessao('ADMIN')
  if (session instanceof NextResponse) return session

  const categoria = await prisma.categoria.update({
    where: { id: params.id },
    data: { ativo: true },
  })

  return NextResponse.json(categoria)
}
