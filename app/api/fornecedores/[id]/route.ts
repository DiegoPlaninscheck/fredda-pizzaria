import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function validarCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '')
  if (digits.length !== 14) return false
  if (/^(\d)\1+$/.test(digits)) return false

  const calc = (d: string, len: number) => {
    let sum = 0
    let pos = len - 7
    for (let i = len; i >= 1; i--) {
      sum += parseInt(d[len - i]) * pos--
      if (pos < 2) pos = 9
    }
    const rem = sum % 11
    return rem < 2 ? 0 : 11 - rem
  }

  if (calc(digits, 12) !== parseInt(digits[12])) return false
  if (calc(digits, 13) !== parseInt(digits[13])) return false
  return true
}

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
    if (!validarCNPJ(cnpj.trim())) {
      return NextResponse.json({ error: 'CNPJ inválido' }, { status: 400 })
    }
    const cnpjDigits = cnpj.replace(/\D/g, '')
    const existe = await prisma.fornecedor.findFirst({
      where: { cnpj: cnpjDigits, NOT: { id: params.id } },
    })
    if (existe) {
      return NextResponse.json({ error: 'CNPJ já cadastrado' }, { status: 409 })
    }
  }

  const fornecedor = await prisma.fornecedor.update({
    where: { id: params.id },
    data: {
      nome: nome.trim(),
      cnpj: cnpj ? cnpj.replace(/\D/g, '') : null,
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
