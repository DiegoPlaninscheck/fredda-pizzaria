import { NextResponse } from 'next/server'
import { exigirSessao } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { reporEstoqueReceita } from '@/lib/estoque'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await exigirSessao()
  if (session instanceof NextResponse) return session

  const { pago, entregue, dataEntrega } = await req.json()

  const atual = await prisma.venda.findUnique({ where: { id: params.id } })
  if (!atual) return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 })

  const marcandoEntregue = entregue === true && !atual.entregue

  const venda = await prisma.venda.update({
    where: { id: params.id },
    data: {
      pago: pago !== undefined ? Boolean(pago) : undefined,
      entregue: entregue !== undefined ? Boolean(entregue) : undefined,
      dataEntrega: dataEntrega !== undefined
        ? (dataEntrega ? new Date(dataEntrega) : null)
        : (marcandoEntregue && !atual.dataEntrega ? new Date() : undefined),
    },
    include: {
      receita: { select: { id: true, nome: true } },
      usuario: { select: { nome: true } },
    },
  })

  return NextResponse.json(venda)
}

/** Cancela a venda e devolve as unidades ao estoque de produto pronto. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await exigirSessao('ADMIN')
  if (session instanceof NextResponse) return session

  const venda = await prisma.venda.findUnique({ where: { id: params.id } })
  if (!venda) return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 })

  if (venda.pedidoId) {
    return NextResponse.json(
      { error: `Esta venda foi gerada pelo pedido #${venda.pedidoId}. Cancele o pedido em vez da venda.` },
      { status: 409 }
    )
  }

  await prisma.$transaction(async (tx) => {
    await tx.venda.delete({ where: { id: params.id } })
    await reporEstoqueReceita(tx, venda.receitaId, venda.quantidade)
  })

  return NextResponse.json({ ok: true })
}
