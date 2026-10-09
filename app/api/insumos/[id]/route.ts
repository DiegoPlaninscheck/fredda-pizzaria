import { NextResponse } from 'next/server'
import { exigirSessao } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { UnidadeMedida } from '@prisma/client'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await exigirSessao()
  if (session instanceof NextResponse) return session

  const insumo = await prisma.insumo.findUnique({
    where: { id: params.id },
    include: { categoria: true, fornecedor: true },
  })
  if (!insumo) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  return NextResponse.json({
    ...insumo,
    estoqueAbaixoMinimo: insumo.estoqueAtual.lt(insumo.estoqueMinimo),
  })
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await exigirSessao()
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { nome, unidade, estoqueMinimo, precoUnitario, categoriaId, fornecedorId, ativo } = body

  if (ativo === false && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Apenas administradores podem inativar insumos' }, { status: 403 })
  }

  if (!nome?.trim() || !unidade || !categoriaId) {
    return NextResponse.json({ error: 'Nome, unidade e categoria são obrigatórios' }, { status: 400 })
  }

  if (!Object.values(UnidadeMedida).includes(unidade)) {
    return NextResponse.json({ error: 'Unidade inválida' }, { status: 400 })
  }

  const insumo = await prisma.insumo.update({
    where: { id: params.id },
    data: {
      nome: nome.trim(),
      unidade,
      estoqueMinimo: estoqueMinimo !== undefined ? Number(estoqueMinimo) : undefined,
      precoUnitario: precoUnitario !== undefined ? (precoUnitario ? Number(precoUnitario) : null) : undefined,
      categoriaId,
      fornecedorId: fornecedorId || null,
      ativo: ativo !== undefined ? ativo : undefined,
    },
    include: { categoria: true, fornecedor: true },
  })

  return NextResponse.json(insumo)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await exigirSessao('ADMIN')
  if (session instanceof NextResponse) return session

  await prisma.insumo.update({
    where: { id: params.id },
    data: { ativo: false },
  })

  return NextResponse.json({ ok: true })
}
