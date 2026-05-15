import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function validarCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '')
  if (digits.length !== 14) return false
  if (/^(\d)\1+$/.test(digits)) return false // todos iguais

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
    if (!validarCNPJ(cnpj.trim())) {
      return NextResponse.json({ error: 'CNPJ inválido' }, { status: 400 })
    }
    const existe = await prisma.fornecedor.findUnique({ where: { cnpj: cnpj.replace(/\D/g, '') } })
    if (existe) {
      return NextResponse.json({ error: 'CNPJ já cadastrado' }, { status: 409 })
    }
  }

  const fornecedor = await prisma.fornecedor.create({
    data: {
      nome: nome.trim(),
      cnpj: cnpj ? cnpj.replace(/\D/g, '') : null,
      telefone: telefone?.trim() || null,
      email: email?.trim() || null,
      endereco: endereco?.trim() || null,
    },
  })

  return NextResponse.json(fornecedor, { status: 201 })
}
