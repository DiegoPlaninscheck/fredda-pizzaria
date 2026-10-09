import { Prisma } from '@prisma/client'

type Tx = Prisma.TransactionClient
type Quantidade = Prisma.Decimal | number

export class EstoqueInsuficienteError extends Error {}

export function formatarQuantidade(valor: Prisma.Decimal | number | string) {
  return Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

/**
 * Baixa o estoque de produto pronto de uma receita de forma atômica:
 * o UPDATE só acontece se ainda houver saldo, evitando estoque negativo
 * quando duas vendas/pedidos chegam ao mesmo tempo.
 */
export async function baixarEstoqueReceita(tx: Tx, receitaId: string, quantidade: Quantidade) {
  const { count } = await tx.receita.updateMany({
    where: { id: receitaId, estoqueAtual: { gte: quantidade } },
    data: { estoqueAtual: { decrement: quantidade } },
  })

  if (count === 0) {
    const receita = await tx.receita.findUnique({
      where: { id: receitaId },
      select: { nome: true, estoqueAtual: true },
    })
    throw new EstoqueInsuficienteError(
      receita
        ? `Estoque insuficiente de ${receita.nome}. Disponível: ${formatarQuantidade(receita.estoqueAtual)}`
        : 'Receita não encontrada'
    )
  }
}

export async function reporEstoqueReceita(tx: Tx, receitaId: string, quantidade: Quantidade) {
  await tx.receita.update({
    where: { id: receitaId },
    data: { estoqueAtual: { increment: quantidade } },
  })
}

/** Mesmo princípio de `baixarEstoqueReceita`, para insumos. */
export async function baixarEstoqueInsumo(tx: Tx, insumoId: string, quantidade: Quantidade) {
  const { count } = await tx.insumo.updateMany({
    where: { id: insumoId, estoqueAtual: { gte: quantidade } },
    data: { estoqueAtual: { decrement: quantidade } },
  })

  if (count === 0) {
    const insumo = await tx.insumo.findUnique({
      where: { id: insumoId },
      select: { nome: true, estoqueAtual: true },
    })
    throw new EstoqueInsuficienteError(
      insumo
        ? `Saldo insuficiente de ${insumo.nome}. Estoque atual: ${formatarQuantidade(insumo.estoqueAtual)}`
        : 'Insumo não encontrado'
    )
  }
}
