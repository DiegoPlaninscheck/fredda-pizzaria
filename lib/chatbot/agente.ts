import Anthropic from '@anthropic-ai/sdk'
import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { SYSTEM_PROMPT } from '@/lib/chatbot/prompt'
import { criarFerramentas } from '@/lib/chatbot/ferramentas'

const MODELO = 'claude-sonnet-5-5'
const INATIVIDADE_MS = 24 * 60 * 60 * 1000 // mesma janela de atendimento do WhatsApp
const MAX_MENSAGENS_HISTORICO = 80

const MENSAGEM_ERRO = 'Desculpe, tive um problema para responder agora. Pode tentar de novo em alguns instantes?'
const MENSAGEM_ATENDENTE = 'Vou chamar alguém da nossa equipe para continuar o seu atendimento. Já já respondemos por aqui!'

let client: Anthropic | null = null
function anthropic() {
  // Criado sob demanda para o build não exigir ANTHROPIC_API_KEY
  return (client ??= new Anthropic())
}

export interface MensagemRecebida {
  telefone: string
  texto: string
  nomePerfil?: string
  waMessageId?: string
}

export interface RespostaChatbot {
  conversaId: string
  /** null quando não há o que responder (mensagem duplicada ou conversa com atendente humano) */
  texto: string | null
}

async function obterConversaAtiva(clienteId: string) {
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

function blocoDeContexto(nomePerfil?: string) {
  const agora = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const linhas = [`Data e hora atual: ${agora} (horário de Brasília)`]
  if (nomePerfil) linhas.push(`Nome no perfil do WhatsApp: ${nomePerfil}`)
  return `<contexto>\n${linhas.join('\n')}\n</contexto>`
}

/**
 * Processa uma mensagem de texto de um cliente e devolve a resposta do chatbot.
 * Também grava a transcrição (MensagemWhatsApp) e o histórico da conversa.
 */
export async function responderMensagem(msg: MensagemRecebida): Promise<RespostaChatbot> {
  // A Meta reenvia o webhook quando não recebe 200 a tempo; reenvios são ignorados
  if (msg.waMessageId) {
    const jaRecebida = await prisma.mensagemWhatsApp.findUnique({ where: { waMessageId: msg.waMessageId } })
    if (jaRecebida) return { conversaId: jaRecebida.conversaId, texto: null }
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
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { conversaId: conversa.id, texto: null }
    }
    throw e
  }

  if (conversa.status === 'HUMANO') {
    await prisma.conversa.update({ where: { id: conversa.id }, data: { ultimaMensagemEm: new Date() } })
    return { conversaId: conversa.id, texto: null }
  }

  const historico = conversa.historico as unknown as BetaMessageParam[]
  // Impede que o cliente "falsifique" o bloco de contexto gerado pelo sistema
  const textoCliente = msg.texto.replace(/<\/?contexto>/gi, '')

  let runner
  let resposta: string
  try {
    runner = anthropic().beta.messages.toolRunner({
      model: MODELO,
      max_tokens: 8000,
      output_config: { effort: 'low' }, // conversa curta guiada por ferramentas
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      cache_control: { type: 'ephemeral' }, // também reaproveita o histórico entre mensagens
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default', // se o modelo recusar por segurança, a API tenta outro modelo
      tools: criarFerramentas({ clienteId: cliente.id, conversaId: conversa.id }),
      max_iterations: 12,
      messages: [
        ...historico,
        {
          role: 'user',
          content: [
            { type: 'text', text: blocoDeContexto(msg.nomePerfil) },
            { type: 'text', text: textoCliente },
          ],
        },
      ],
    })

    const final = await runner.runUntilDone()

    if (final.stop_reason === 'refusal') {
      await prisma.conversa.update({ where: { id: conversa.id }, data: { status: 'HUMANO' } })
      resposta = MENSAGEM_ATENDENTE
    } else {
      resposta = final.content
        .flatMap((b) => (b.type === 'text' ? [b.text] : []))
        .join('\n\n')
        .trim()
      if (!resposta) resposta = MENSAGEM_ERRO
    }

    console.info(
      `[chatbot] conversa=${conversa.id} stop=${final.stop_reason} ` +
      `in=${final.usage.input_tokens} cache_read=${final.usage.cache_read_input_tokens ?? 0} out=${final.usage.output_tokens}`
    )
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      console.error(`[chatbot] erro da API da Anthropic (${e.status}):`, e.message)
    } else {
      console.error('[chatbot] erro ao gerar resposta:', e)
    }
    // O cliente sempre recebe uma resposta. O histórico não é salvo: a próxima
    // mensagem recomeça do último estado consistente da conversa.
    await registrarSaida(conversa.id, MENSAGEM_ERRO)
    return { conversaId: conversa.id, texto: MENSAGEM_ERRO }
  }

  // Só acrescenta ao histórico (nunca reescreve turnos antigos), como a API recomenda
  await prisma.conversa.update({
    where: { id: conversa.id },
    data: {
      historico: runner.params.messages as unknown as Prisma.InputJsonValue,
      ultimaMensagemEm: new Date(),
    },
  })
  await registrarSaida(conversa.id, resposta)

  return { conversaId: conversa.id, texto: resposta }
}

async function registrarSaida(conversaId: string, texto: string) {
  await prisma.mensagemWhatsApp.create({ data: { direcao: 'SAIDA', texto, conversaId } })
}

/**
 * Acrescenta ao histórico uma mensagem enviada pela equipe (resposta manual ou
 * aviso de status do pedido), para o bot ter o contexto quando o cliente responder.
 */
export async function registrarMensagemDaEquipe(conversaId: string, texto: string) {
  const conversa = await prisma.conversa.findUnique({ where: { id: conversaId } })
  if (!conversa) return

  const historico = conversa.historico as unknown as BetaMessageParam[]
  // A conversa precisa começar com o cliente; avisos antes disso ficam só na transcrição
  const novoHistorico = historico.length > 0
    ? [...historico, { role: 'assistant', content: [{ type: 'text', text: texto }] } satisfies BetaMessageParam]
    : historico

  await prisma.conversa.update({
    where: { id: conversaId },
    data: { historico: novoHistorico as unknown as Prisma.InputJsonValue },
  })
  await registrarSaida(conversaId, texto)
}
