import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { obterConversaAtiva, registrarSaida } from '@/lib/chatbot/conversas'
import {
  descreverEstado, estadoInicial, processarFluxo, promptEtapa, type EstadoFluxo,
} from '@/lib/chatbot/fluxo'
import { responderComIA } from '@/lib/chatbot/agente'
import { botoes, LIMITES, paraTranscricao, texto, type MensagemSaida, type Opcao } from '@/lib/chatbot/mensagens'
import { metricas } from '@/lib/metricas'

export interface MensagemRecebida {
  telefone: string
  texto: string
  /** id da opção quando o cliente toca em um botão ou item de lista */
  respostaId?: string
  nomePerfil?: string
  waMessageId?: string
}

/** Botões mostrados depois de uma resposta da IA, para o cliente voltar ao fluxo. */
function botoesDeRetorno(estado: EstadoFluxo): Opcao[] {
  return estado.etapa === 'MENU'
    ? [{ id: 'menu:pedir', titulo: '🍕 Fazer pedido' }, { id: 'nav:menu', titulo: '📋 Menu' }]
    : [{ id: 'nav:continuar', titulo: '▶️ Continuar pedido' }, { id: 'nav:menu', titulo: '📋 Menu' }]
}

function respostaDaIAComBotoes(textoIA: string, estado: EstadoFluxo): MensagemSaida[] {
  const opcoes = botoesDeRetorno(estado)
  return textoIA.length <= LIMITES.corpo
    ? [botoes(textoIA, opcoes)]
    : [texto(textoIA), botoes('Quer continuar por aqui?', opcoes)]
}

/**
 * Atende uma mensagem do cliente (WhatsApp ou simulador): o fluxo guiado responde
 * primeiro; se ele não entender, a IA tenta ajudar; sem IA, o menu é mostrado de novo.
 * Grava a transcrição e devolve as mensagens a enviar.
 */
export async function atenderMensagem(msg: MensagemRecebida): Promise<MensagemSaida[]> {
  // A Meta reenvia o webhook quando não recebe 200 a tempo; reenvios são ignorados
  if (msg.waMessageId) {
    const jaRecebida = await prisma.mensagemWhatsApp.findUnique({ where: { waMessageId: msg.waMessageId } })
    if (jaRecebida) return []
  }

  const cliente = await prisma.cliente.upsert({
    where: { telefone: msg.telefone },
    create: { telefone: msg.telefone },
    update: {},
  })
  const conversa = await obterConversaAtiva(cliente.id)

  try {
    await prisma.mensagemWhatsApp.create({
      data: { waMessageId: msg.waMessageId ?? null, direcao: 'ENTRADA', texto: msg.texto, conversaId: conversa.id },
    })
  } catch (e) {
    // Reenvio que chegou ao mesmo tempo que o original (passou pela checagem acima)
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return []
    throw e
  }

  // Conversa com a equipe: o atendimento automático fica em silêncio
  if (conversa.status === 'HUMANO') {
    await prisma.conversa.update({ where: { id: conversa.id }, data: { ultimaMensagemEm: new Date() } })
    return []
  }

  const ctx = { clienteId: cliente.id, conversaId: conversa.id, nomePerfil: msg.nomePerfil }
  const resultado = await processarFluxo(
    conversa.estadoFluxo as EstadoFluxo | null,
    { texto: msg.texto, respostaId: msg.respostaId },
    ctx
  )
  let { estado, saidas } = resultado

  if (resultado.chamarAtendente) {
    await prisma.conversa.update({ where: { id: conversa.id }, data: { status: 'HUMANO' } })
  }

  if (resultado.naoEntendido) {
    const ia = await responderComIA({
      conversa,
      clienteId: cliente.id,
      texto: msg.texto,
      nomePerfil: msg.nomePerfil,
      situacaoMenu: descreverEstado(estado),
    })

    if (ia) {
      metricas.chatbotMensagens.inc({ origem: 'ia' })
      if (ia.criouPedido) estado = estadoInicial()
      saidas = ia.chamouAtendente ? [texto(ia.texto)] : respostaDaIAComBotoes(ia.texto, estado)
    } else {
      metricas.chatbotMensagens.inc({ origem: 'fallback' })
      // Sem IA (ou com falha): explica e repete a pergunta da etapa atual
      const pergunta = await promptEtapa(estado, ctx)
      const temOpcoes = pergunta.some((m) => m.tipo !== 'texto')
      saidas = [texto(temOpcoes ? 'Desculpe, não entendi 🤔 Escolha uma das opções abaixo:' : 'Desculpe, não entendi 🤔'), ...pergunta]
    }
  } else {
    metricas.chatbotMensagens.inc({ origem: 'fluxo' })
  }

  await prisma.conversa.update({
    where: { id: conversa.id },
    data: { estadoFluxo: estado as unknown as Prisma.InputJsonValue, ultimaMensagemEm: new Date() },
  })
  for (const saida of saidas) await registrarSaida(conversa.id, paraTranscricao(saida))

  return saidas
}
