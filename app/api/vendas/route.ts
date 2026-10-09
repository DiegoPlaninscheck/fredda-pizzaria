import { NextResponse } from 'next/server'
import { exigirSessao } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { baixarEstoqueReceita, EstoqueInsuficienteError } from '@/lib/estoque'

export async function GET(req: Request) {
  const session = await exigirSessao()
  if (session instanceof NextResponse) return session

  const { searchParams } = new URL(req.url)
  const receitaId = searchParams.get('receitaId')
  const dataInicio = searchParams.get('dataInicio')
  const dataFim = searchParams.get('dataFim')

  const where: {
    receitaId?: string
    dataVenda?: { gte?: Date; lte?: Date }
  } = {}

  if (receitaId) where.receitaId = receitaId

  if (dataInicio || dataFim) {
    where.dataVenda = {}
    if (dataInicio) where.dataVenda.gte = new Date(dataInicio)
    if (dataFim) {
      const fim = new Date(dataFim)
      fim.setHours(23, 59, 59, 999)
      where.dataVenda.lte = fim
    }
  }

  const vendas = await prisma.venda.findMany({
    where,
    orderBy: { dataVenda: 'desc' },
    include: {
      receita: { select: { id: true, nome: true } },
      usuario: { select: { nome: true } },
    },
  })

  return NextResponse.json(vendas)
}

export async function POST(req: Request) {
  const session = await exigirSessao()
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const {
    receitaId, cliente, quantidade, precoUnitario,
    formaPagamento, pago, entregue, dataVenda, dataEntrega, observacoes,
  } = body

  if (!receitaId) return NextResponse.json({ error: 'Receita é obrigatória' }, { status: 400 })
  if (!cliente?.trim()) return NextResponse.json({ error: 'Cliente é obrigatório' }, { status: 400 })

  const qtd = Number(quantidade)
  if (isNaN(qtd) || qtd <= 0) {
    return NextResponse.json({ error: 'Quantidade deve ser maior que zero' }, { status: 400 })
  }

  const preco = Number(precoUnitario)
  if (isNaN(preco) || preco <= 0) {
    return NextResponse.json({ error: 'Preço unitário deve ser maior que zero' }, { status: 400 })
  }

  const receita = await prisma.receita.findUnique({ where: { id: receitaId } })
  if (!receita) return NextResponse.json({ error: 'Receita não encontrada' }, { status: 404 })

  try {
    const venda = await prisma.$transaction(async (tx) => {
      await baixarEstoqueReceita(tx, receitaId, qtd)
      return tx.venda.create({
        data: {
          receitaId,
          cliente: cliente.trim(),
          quantidade: qtd,
          precoUnitario: preco,
          valorTotal: qtd * preco,
          formaPagamento: formaPagamento?.trim() || null,
          pago: Boolean(pago),
          entregue: Boolean(entregue),
          dataVenda: dataVenda ? new Date(dataVenda) : new Date(),
          dataEntrega: dataEntrega ? new Date(dataEntrega) : null,
          observacoes: observacoes?.trim() || null,
          usuarioId: session.user.id,
        },
        include: {
          receita: { select: { id: true, nome: true } },
          usuario: { select: { nome: true } },
        },
      })
    })

    return NextResponse.json(venda, { status: 201 })
  } catch (e) {
    if (e instanceof EstoqueInsuficienteError) {
      return NextResponse.json({ error: e.message }, { status: 422 })
    }
    throw e
  }
}
