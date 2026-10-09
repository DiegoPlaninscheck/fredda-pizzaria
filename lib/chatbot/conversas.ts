import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const INATIVIDADE_MS = 24 * 60 * 60 * 1000 // mesma janela de atendimento do WhatsApp
const MAX_MENSAGENS_HISTORICO = 80

/** Conversa em andamento do cliente; abre uma nova após 24h sem mensagens. */
export async function obterConversaAtiva(clienteId: string) {
  const conversa = await prisma.conversa.findFirst({
    where: { clienteId, status: { not: 'ENCERRADA' } },
    orderBy: { ultimaMensagemEm: 'desc' },
  })

  const expirada = conversa && Date.now() - conversa.ultimaMensagemEm.getTime() > INATIVIDADE_MS
  const longaDemais = conversa && (conversa.historico as unknown[]).length > MAX_MENSAGENS_HISTORICO

  if (conversa && !expirada && !longaDemais) return conversa

  if (conversa) {
    await prisma.conversa.update({ where: { id: conversa.id }, data: { status: 'ENCERRADA' } })
  }
  return prisma.conversa.create({ data: { clienteId, historico: [] } })
}

export async function registrarSaida(conversaId: string, texto: string) {
  await prisma.mensagemWhatsApp.create({ data: { direcao: 'SAIDA', texto, conversaId } })
}

/**
 * Acrescenta ao histórico da IA uma mensagem enviada pela equipe (resposta manual
 * ou aviso de status do pedido), para ela ter o contexto se o cliente responder.
 */
export async function registrarMensagemDaEquipe(conversaId: string, texto: string) {
  const conversa = await prisma.conversa.findUnique({ where: { id: conversaId } })
  if (!conversa) return

  const historico = conversa.historico as unknown as BetaMessageParam[]
  // O histórico da IA precisa começar com o cliente; avisos antes disso ficam só na transcrição
  const novoHistorico = historico.length > 0
    ? [...historico, { role: 'assistant', content: [{ type: 'text', text: texto }] } satisfies BetaMessageParam]
    : historico

  await prisma.conversa.update({
    where: { id: conversaId },
    data: { historico: novoHistorico as unknown as Prisma.InputJsonValue },
  })
  await registrarSaida(conversaId, texto)
}
