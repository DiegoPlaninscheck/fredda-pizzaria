import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const busca = searchParams.get('busca') || ''
  const apenasAtivos = searchParams.get('ativo') !== 'false'

  const fornecedores = await prisma.fornecedor.findMany({
    where: {
      ativo: apenasAtivos ? true : undefined,
      nome: busca ? { contains: busca } : undefined,
    },
    orderBy: { nome: 'asc' },
    include: { _count: { select: { insumos: true } } },
  })

  return NextResponse.json(fornecedores)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { nome, cnpj, telefone, email, endereco } = body

  if (!nome?.trim()) {
    return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
  }

  if (cnpj?.trim()) {
    const existe = await prisma.fornecedor.findUnique({ where: { cnpj: cnpj.trim() } })
    if (existe) {
      return NextResponse.json({ error: 'CNPJ já cadastrado' }, { status: 409 })
    }
  }

  const fornecedor = await prisma.fornecedor.create({
    data: {
      nome: nome.trim(),
      cnpj: cnpj?.trim() || null,
      telefone: telefone?.trim() || null,
      email: email?.trim() || null,
      endereco: endereco?.trim() || null,
    },
  })

  return NextResponse.json(fornecedor, { status: 201 })
}
