import { Prisma, StatusPedido, TipoEntrega } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { baixarEstoqueReceita, EstoqueInsuficienteError, reporEstoqueReceita } from '@/lib/estoque'
import { STATUS_PEDIDO_LABEL } from '@/lib/pedidos-ui'
import { metricas } from '@/lib/metricas'

/** Conta o pedido no status em que ficou (só depois que a transação foi confirmada). */
function registrarMetrica<T extends { canal: string; status: string }>(pedido: T): T {
  metricas.pedidos.inc({ canal: pedido.canal, status: pedido.status })
  return pedido
}

export class PedidoError extends Error {}

export const incluirPedido = {
  cliente: true,
  itens: { include: { receita: { select: { id: true, nome: true } } } },
} satisfies Prisma.PedidoInclude

export type PedidoCompleto = Prisma.PedidoGetPayload<{ include: typeof incluirPedido }>

export interface NovoPedido {
  clienteId: string
  conversaId?: string | null
  itens: { receitaId: string; quantidade: number }[]
  tipoEntrega: TipoEntrega
  enderecoEntrega?: string | null
  formaPagamento?: string | null
  dataEntregaDesejada?: Date | null
  observacoes?: string | null
}

/**
 * Cria um pedido PENDENTE com o preço atual do cardápio e reserva
 * o estoque de produto pronto (devolvido se o pedido for cancelado).
 */
export async function criarPedido(dados: NovoPedido): Promise<PedidoCompleto> {
  // Junta itens repetidos do mesmo sabor
  const quantidades = new Map<string, number>()
  for (const item of dados.itens) {
    if (!Number.isInteger(item.quantidade) || item.quantidade <= 0) {
      throw new PedidoError('Quantidades devem ser números inteiros maiores que zero')
    }
    quantidades.set(item.receitaId, (quantidades.get(item.receitaId) ?? 0) + item.quantidade)
  }
  if (quantidades.size === 0) throw new PedidoError('O pedido precisa de ao menos um item')

  if (dados.tipoEntrega === 'ENTREGA' && !dados.enderecoEntrega?.trim()) {
    throw new PedidoError('Endereço é obrigatório para entrega')
  }

  const receitas = await prisma.receita.findMany({
    where: { id: { in: Array.from(quantidades.keys()) }, ativo: true, precoVenda: { not: null } },
  })
  if (receitas.length !== quantidades.size) {
    throw new PedidoError('Um ou mais itens não estão disponíveis no cardápio')
  }

  const itens = receitas.map((r) => ({
    receitaId: r.id,
    quantidade: quantidades.get(r.id)!,
    precoUnitario: r.precoVenda!,
  }))
  const valorTotal = itens.reduce(
    (total, i) => total.add(new Prisma.Decimal(i.precoUnitario).mul(i.quantidade)),
    new Prisma.Decimal(0)
  )

  try {
    const pedido = await prisma.$transaction(async (tx) => {
      for (const item of itens) {
        await baixarEstoqueReceita(tx, item.receitaId, item.quantidade)
      }
      return tx.pedido.create({
        data: {
          clienteId: dados.clienteId,
          conversaId: dados.conversaId ?? null,
          tipoEntrega: dados.tipoEntrega,
          enderecoEntrega: dados.tipoEntrega === 'ENTREGA' ? dados.enderecoEntrega!.trim() : null,
          formaPagamento: dados.formaPagamento ?? null,
          dataEntregaDesejada: dados.dataEntregaDesejada ?? null,
          observacoes: dados.observacoes?.trim() || null,
          valorTotal,
          itens: { create: itens },
        },
        include: incluirPedido,
      })
    })
    return registrarMetrica(pedido)
  } catch (e) {
    if (e instanceof EstoqueInsuficienteError) throw new PedidoError(e.message)
    throw e
  }
}

/**
 * Atualiza o status somente se o pedido estiver em um dos status esperados.
 * O filtro no próprio UPDATE evita que duas ações simultâneas
 * (ex.: cliente cancelando enquanto a equipe confirma) se atropelem.
 */
async function transicionar(
  tx: Prisma.TransactionClient,
  pedidoId: number,
  de: StatusPedido[],
  para: StatusPedido
) {
  const { count } = await tx.pedido.updateMany({
    where: { id: pedidoId, status: { in: de } },
    data: { status: para },
  })
  if (count === 0) {
    const atual = await tx.pedido.findUnique({ where: { id: pedidoId }, select: { status: true } })
    throw new PedidoError(
      atual ? `Pedido #${pedidoId} está ${ROTULO_STATUS[atual.status].toLowerCase()}` : `Pedido #${pedidoId} não encontrado`
    )
  }
}

/** PENDENTE → CONFIRMADO: gera uma venda por item (o estoque já foi reservado na criação). */
export async function confirmarPedido(pedidoId: number, usuarioId: string) {
  return registrarMetrica(await prisma.$transaction(async (tx) => {
    await transicionar(tx, pedidoId, ['PENDENTE'], 'CONFIRMADO')
    const pedido = await tx.pedido.findUniqueOrThrow({ where: { id: pedidoId }, include: incluirPedido })

    for (const item of pedido.itens) {
      await tx.venda.create({
        data: {
          pedidoId,
          receitaId: item.receitaId,
          cliente: pedido.cliente.nome || pedido.cliente.telefone,
          quantidade: item.quantidade,
          precoUnitario: item.precoUnitario,
          valorTotal: new Prisma.Decimal(item.precoUnitario).mul(item.quantidade),
          formaPagamento: pedido.formaPagamento,
          pago: false,
          entregue: false,
          observacoes: `Pedido #${pedidoId} (${pedido.canal === 'WHATSAPP' ? 'WhatsApp' : 'manual'})`,
          usuarioId,
        },
      })
    }
    return pedido
  }))
}

/** CONFIRMADO → ENTREGUE: marca as vendas do pedido como entregues. */
export async function entregarPedido(pedidoId: number) {
  return registrarMetrica(await prisma.$transaction(async (tx) => {
    await transicionar(tx, pedidoId, ['CONFIRMADO'], 'ENTREGUE')
    await tx.venda.updateMany({
      where: { pedidoId },
      data: { entregue: true, dataEntrega: new Date() },
    })
    return tx.pedido.findUniqueOrThrow({ where: { id: pedidoId }, include: incluirPedido })
  }))
}

/**
 * Cancela o pedido, devolve as unidades ao estoque e remove as vendas
 * geradas na confirmação. `apenasPendente` é usado quando quem cancela é o cliente.
 */
export async function cancelarPedido(pedidoId: number, { apenasPendente = false } = {}) {
  return registrarMetrica(await prisma.$transaction(async (tx) => {
    await transicionar(tx, pedidoId, apenasPendente ? ['PENDENTE'] : ['PENDENTE', 'CONFIRMADO'], 'CANCELADO')
    const pedido = await tx.pedido.findUniqueOrThrow({ where: { id: pedidoId }, include: incluirPedido })

    for (const item of pedido.itens) {
      await reporEstoqueReceita(tx, item.receitaId, item.quantidade)
    }
    await tx.venda.deleteMany({ where: { pedidoId } })
    return pedido
  }))
}

export const ROTULO_STATUS = STATUS_PEDIDO_LABEL as Record<StatusPedido, string>

export function formatarMoeda(valor: Prisma.Decimal | number | string) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function resumoItens(pedido: PedidoCompleto) {
  return pedido.itens
    .map((i) => `${Number(i.quantidade)}x ${i.receita.nome} (${formatarMoeda(i.precoUnitario)})`)
    .join('\n')
}

/** Texto enviado ao cliente pelo WhatsApp quando a equipe muda o status do pedido. */
export function mensagemDeStatus(pedido: PedidoCompleto) {
  const cabecalho = `Pedido #${pedido.id}`
  switch (pedido.status) {
    case 'CONFIRMADO':
      return `✅ ${cabecalho} confirmado!\n\n${resumoItens(pedido)}\nTotal: ${formatarMoeda(pedido.valorTotal)}\n\n` +
        (pedido.tipoEntrega === 'ENTREGA'
          ? 'Avisaremos quando ele sair para entrega.'
          : 'Avisaremos quando estiver pronto para retirada.')
    case 'ENTREGUE':
      return `🍕 ${cabecalho} entregue. Obrigado pela preferência e bom apetite!`
    case 'CANCELADO':
      return `❌ ${cabecalho} foi cancelado. Se tiver alguma dúvida, é só responder esta mensagem.`
    default:
      return `${cabecalho}: ${ROTULO_STATUS[pedido.status]}`
  }
}
