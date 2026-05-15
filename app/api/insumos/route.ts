import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UnidadeMedida } from '@prisma/client'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const categoriaId = searchParams.get('categoriaId') || undefined
  const apenasAtivos = searchParams.get('ativo') !== 'false'
  const apenasAlerta = searchParams.get('alerta') === 'true'

  const insumos = await prisma.insumo.findMany({
    where: {
      ativo: apenasAtivos ? true : undefined,
      categoriaId: categoriaId || undefined,
    },
    orderBy: { nome: 'asc' },
    include: { categoria: true, fornecedor: true },
  })

  const resultado = insumos.map((insumo) => ({
    ...insumo,
    estoqueAbaixoMinimo: insumo.estoqueAtual < insumo.estoqueMinimo,
  }))

  if (apenasAlerta) {
    return NextResponse.json(resultado.filter((i) => i.estoqueAbaixoMinimo))
  }

  return NextResponse.json(resultado)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { nome, unidade, estoqueMinimo, precoUnitario, categoriaId, fornecedorId } = body

  if (!nome?.trim() || !unidade || !categoriaId) {
    return NextResponse.json({ error: 'Nome, unidade e categoria são obrigatórios' }, { status: 400 })
  }

  if (!Object.values(UnidadeMedida).includes(unidade)) {
    return NextResponse.json({ error: 'Unidade inválida' }, { status: 400 })
  }

  const insumo = await prisma.insumo.create({
    data: {
      nome: nome.trim(),
      unidade,
      estoqueMinimo: estoqueMinimo ? Number(estoqueMinimo) : 0,
      precoUnitario: precoUnitario ? Number(precoUnitario) : null,
      categoriaId,
      fornecedorId: fornecedorId || null,
    },
    include: { categoria: true, fornecedor: true },
  })

  return NextResponse.json(insumo, { status: 201 })
}
