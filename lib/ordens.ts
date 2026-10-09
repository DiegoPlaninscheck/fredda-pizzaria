import { Prisma, StatusOrdem } from '@prisma/client'
import { reporEstoqueReceita } from '@/lib/estoque'

type Tx = Prisma.TransactionClient

export const STATUS_FINAIS: StatusOrdem[] = ['CONCLUIDA', 'CANCELADA']

export class OrdemFinalizadaError extends Error {
  constructor() {
    super('Ordem já foi concluída ou cancelada')
  }
}

/**
 * Muda o status da ordem somente se ela ainda não estiver finalizada.
 * O filtro no próprio UPDATE impede que duas requisições simultâneas
 * concluam a mesma ordem (e reponham o estoque duas vezes).
 */
async function finalizar(tx: Tx, ordemId: string, status: StatusOrdem) {
  const { count } = await tx.ordemProducao.updateMany({
    where: { id: ordemId, status: { notIn: STATUS_FINAIS } },
    data: { status },
  })
  if (count === 0) throw new OrdemFinalizadaError()
}

/** Conclui a ordem, fecha as etapas abertas e repõe o estoque de produto pronto. */
export async function concluirOrdem(tx: Tx, ordemId: string) {
  await finalizar(tx, ordemId, 'CONCLUIDA')

  const ordem = await tx.ordemProducao.findUniqueOrThrow({ where: { id: ordemId } })
  const agora = new Date()

  const abertas = await tx.etapaFermentacao.findMany({
    where: { ordemId, status: { not: 'CONCLUIDA' } },
  })
  for (const etapa of abertas) {
    const emAndamento = etapa.status === 'EM_ANDAMENTO' && etapa.iniciadaEm
    await tx.etapaFermentacao.update({
      where: { id: etapa.id },
      data: {
        status: 'CONCLUIDA',
        minutosDecorridos: emAndamento
          ? etapa.minutosDecorridos + Math.round((agora.getTime() - etapa.iniciadaEm!.getTime()) / 60000)
          : undefined,
        iniciadaEm: null,
        concluidaEm: agora,
      },
    })
  }

  await reporEstoqueReceita(tx, ordem.receitaId, ordem.quantidade)
}

/** Cancela a ordem, pausa a etapa em andamento e devolve os insumos baixados na criação. */
export async function cancelarOrdem(tx: Tx, ordemId: string, usuarioId: string) {
  await finalizar(tx, ordemId, 'CANCELADA')

  const agora = new Date()
  const emAndamento = await tx.etapaFermentacao.findMany({
    where: { ordemId, status: 'EM_ANDAMENTO' },
  })
  for (const etapa of emAndamento) {
    await tx.etapaFermentacao.update({
      where: { id: etapa.id },
      data: {
        status: 'PAUSADA',
        minutosDecorridos: etapa.iniciadaEm
          ? etapa.minutosDecorridos + Math.round((agora.getTime() - etapa.iniciadaEm.getTime()) / 60000)
          : undefined,
        iniciadaEm: null,
      },
    })
  }

  // Ordens criadas antes da baixa automática não têm movimentações — nada a estornar.
  const saidas = await tx.movimentacaoEstoque.findMany({
    where: { ordemId, tipo: 'SAIDA' },
  })
  for (const saida of saidas) {
    await tx.movimentacaoEstoque.create({
      data: {
        tipo: 'ENTRADA',
        quantidade: saida.quantidade,
        motivo: `Estorno — ordem de produção ${ordemId.slice(-6).toUpperCase()} cancelada`,
        insumoId: saida.insumoId,
        usuarioId,
        ordemId,
      },
    })
    await tx.insumo.update({
      where: { id: saida.insumoId },
      data: { estoqueAtual: { increment: saida.quantidade } },
    })
  }
}
