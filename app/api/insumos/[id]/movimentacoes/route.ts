import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TipoMovimentacao } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const tipo = searchParams.get('tipo') as TipoMovimentacao | null
  const dataInicio = searchParams.get('dataInicio')
  const dataFim = searchParams.get('dataFim')

  // Busca todas para calcular saldo acumulado
  const todas = await prisma.movimentacaoEstoque.findMany({
    where: { insumoId: params.id },
    orderBy: { createdAt: 'asc' },
  })

  // Saldo acumulado crescente (início = 0)
  let saldo = new Decimal(0)
  const comSaldo = todas.map((m) => {
    saldo = m.tipo === TipoMovimentacao.ENTRADA
      ? saldo.add(m.quantidade)
      : saldo.sub(m.quantidade)
    return { ...m, saldoApos: saldo.toFixed(3) }
  })

  // Aplica filtros APÓS calcular saldo
  let resultado = [...comSaldo].reverse() // mais recente primeiro

  if (tipo && Object.values(TipoMovimentacao).includes(tipo)) {
    resultado = resultado.filter((m) => m.tipo === tipo)
  }
  if (dataInicio) {
    const inicio = new Date(dataInicio)
    resultado = resultado.filter((m) => new Date(m.createdAt) >= inicio)
  }
  if (dataFim) {
    const fim = new Date(dataFim)
    fim.setHours(23, 59, 59, 999)
    resultado = resultado.filter((m) => new Date(m.createdAt) <= fim)
  }

  // Carrega includes apenas para o resultado filtrado
  const ids = resultado.map((m) => m.id)
  const detalhes = await prisma.movimentacaoEstoque.findMany({
    where: { id: { in: ids } },
    include: { fornecedor: true, usuario: { select: { nome: true } } },
  })
  const detalhesMap = new Map(detalhes.map((d) => [d.id, d]))

  const final = resultado.map((m) => ({
    ...detalhesMap.get(m.id),
    saldoApos: m.saldoApos,
  }))

  return NextResponse.json(final)
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

  // Valida saldo suficiente antes de saída
  if (tipo === TipoMovimentacao.SAIDA) {
    const insumo = await prisma.insumo.findUnique({
      where: { id: params.id },
      select: { estoqueAtual: true, nome: true },
    })
    if (!insumo) return NextResponse.json({ error: 'Insumo não encontrado' }, { status: 404 })

    if (new Decimal(insumo.estoqueAtual).lt(qtd)) {
      return NextResponse.json(
        { error: `Saldo insuficiente. Estoque atual: ${Number(insumo.estoqueAtual).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}` },
        { status: 422 }
      )
    }
  }

  const loteGerado = lote?.trim() || (tipo === TipoMovimentacao.ENTRADA ? gerarLote() : null)

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
