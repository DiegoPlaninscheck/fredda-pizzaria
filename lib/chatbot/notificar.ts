import { prisma } from '@/lib/prisma'
import { enfileirar, enviarTexto, whatsappConfigurado } from '@/lib/whatsapp'
import { registrarMensagemDaEquipe } from '@/lib/chatbot/agente'

const JANELA_ATENDIMENTO_MS = 24 * 60 * 60 * 1000

export type ResultadoNotificacao = 'enviada' | 'nao_configurado' | 'fora_da_janela' | 'sem_conversa'

/**
 * Envia uma mensagem da equipe para o cliente e registra na conversa.
 *
 * Pela regra do WhatsApp, mensagens livres só podem ser enviadas até 24h depois
 * da última mensagem do cliente; fora disso seria preciso um template aprovado
 * pela Meta (ainda não implementado), então a mensagem não é enviada.
 */
export async function notificarCliente(clienteId: string, texto: string): Promise<ResultadoNotificacao> {
  const cliente = await prisma.cliente.findUniqueOrThrow({ where: { id: clienteId } })

  const conversa = await prisma.conversa.findFirst({
    where: { clienteId },
    orderBy: { ultimaMensagemEm: 'desc' },
  })
  if (!conversa) return 'sem_conversa'

  const ultimaDoCliente = await prisma.mensagemWhatsApp.findFirst({
    where: { direcao: 'ENTRADA', conversa: { clienteId } },
    orderBy: { createdAt: 'desc' },
  })
  if (!ultimaDoCliente || Date.now() - ultimaDoCliente.createdAt.getTime() > JANELA_ATENDIMENTO_MS) {
    console.warn(`[whatsapp] cliente ${cliente.telefone} fora da janela de 24h — mensagem não enviada`)
    return 'fora_da_janela'
  }

  // Sem WhatsApp configurado (ex.: testes com npm run chat) a mensagem fica só registrada na conversa
  await enfileirar(cliente.telefone, async () => {
    await enviarTexto(cliente.telefone, texto)
    await registrarMensagemDaEquipe(conversa.id, texto)
  })
  return whatsappConfigurado() ? 'enviada' : 'nao_configurado'
}
