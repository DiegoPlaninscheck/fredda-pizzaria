import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TipoMovimentacao } from '@prisma/client'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const movimentacoes = await prisma.movimentacaoEstoque.findMany({
    where: { insumoId: params.id },
    orderBy: { createdAt: 'desc' },
    include: { fornecedor: true, usuario: { select: { nome: true } } },
  })

  return NextResponse.json(movimentacoes)
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { tipo, quantidade, motivo, lote, dataVencimento, precoUnitario, fornecedorId } = body

  if (!tipo || !quantidade) {
    return NextResponse.json({ error: 'Tipo e quantidade são obrigatórios' }, { status: 400 })
  }

  if (!Object.values(TipoMovimentacao).includes(tipo)) {
    return NextResponse.json({ error: 'Tipo inválido (ENTRADA ou SAIDA)' }, { status: 400 })
  }

  const qtd = Number(quantidade)
  if (isNaN(qtd) || qtd <= 0) {
    return NextResponse.json({ error: 'Quantidade deve ser maior que zero' }, { status: 400 })
  }

  const loteGerado = lote?.trim() || gerarLote()

  const [movimentacao] = await prisma.$transaction([
    prisma.movimentacaoEstoque.create({
      data: {
        tipo,
        quantidade: qtd,
        motivo: motivo?.trim() || null,
        lote: loteGerado,
        dataVencimento: dataVencimento ? new Date(dataVencimento) : null,
        precoUnitario: precoUnitario ? Number(precoUnitario) : null,
        insumoId: params.id,
        fornecedorId: fornecedorId || null,
        usuarioId: session.user.id,
      },
      include: { fornecedor: true, usuario: { select: { nome: true } } },
    }),
    prisma.insumo.update({
      where: { id: params.id },
      data: {
        estoqueAtual: {
          [tipo === TipoMovimentacao.ENTRADA ? 'increment' : 'decrement']: qtd,
        },
      },
    }),
  ])

  return NextResponse.json(movimentacao, { status: 201 })
}

function gerarLote(): string {
  const hoje = new Date()
  const data = hoje.toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `LOTE-${data}-${rand}`
}
