import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const fornecedor = await prisma.fornecedor.findUnique({ where: { id: params.id } })
  if (!fornecedor) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  return NextResponse.json(fornecedor)
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { nome, cnpj, telefone, email, endereco, ativo } = body

  if (!nome?.trim()) {
    return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
  }

  if (cnpj?.trim()) {
    const existe = await prisma.fornecedor.findFirst({
      where: { cnpj: cnpj.trim(), NOT: { id: params.id } },
    })
    if (existe) {
      return NextResponse.json({ error: 'CNPJ já cadastrado' }, { status: 409 })
    }
  }

  const fornecedor = await prisma.fornecedor.update({
    where: { id: params.id },
    data: {
      nome: nome.trim(),
      cnpj: cnpj?.trim() || null,
      telefone: telefone?.trim() || null,
      email: email?.trim() || null,
      endereco: endereco?.trim() || null,
      ativo: ativo !== undefined ? ativo : undefined,
    },
  })

  return NextResponse.json(fornecedor)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  await prisma.fornecedor.update({
    where: { id: params.id },
    data: { ativo: false },
  })

  return NextResponse.json({ ok: true })
}
