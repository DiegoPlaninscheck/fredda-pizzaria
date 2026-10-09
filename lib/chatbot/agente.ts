import Anthropic from '@anthropic-ai/sdk'
import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { Conversa, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { SYSTEM_PROMPT } from '@/lib/chatbot/prompt'
import { criarFerramentas } from '@/lib/chatbot/ferramentas'

// Plano B do atendimento: só é chamada quando o cliente escreve algo que o
// fluxo guiado (lib/chatbot/fluxo.ts) não entende.

const MODELO = 'claude-sonnet-5-5'
const MENSAGEM_ATENDENTE = 'Vou chamar alguém da nossa equipe para continuar o seu atendimento. Já já respondemos por aqui!'

let client: Anthropic | null = null
function anthropic() {
  // Criado sob demanda para o build não exigir ANTHROPIC_API_KEY
  return (client ??= new Anthropic())
}

/** Sem chave configurada, o atendimento funciona só com o fluxo guiado. */
export function iaDisponivel() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)
}

export interface RespostaIA {
  texto: string
  /** a IA registrou um pedido nesta resposta */
  criouPedido: boolean
  /** a conversa foi passada para a equipe (pela ferramenta ou por recusa do modelo) */
  chamouAtendente: boolean
}

function blocoDeContexto(nomePerfil?: string, situacaoMenu?: string) {
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
  if (situacaoMenu) linhas.push(situacaoMenu)
  return `<contexto>\n${linhas.join('\n')}\n</contexto>`
}

/**
 * Pede à IA uma resposta para a mensagem do cliente. Devolve null se a IA não
 * estiver configurada ou falhar — nesse caso o atendimento volta para o menu.
 */
export async function responderComIA(params: {
  conversa: Conversa
  clienteId: string
  texto: string
  nomePerfil?: string
  situacaoMenu?: string
}): Promise<RespostaIA | null> {
  if (!iaDisponivel()) return null
  const { conversa, clienteId } = params

  const historico = conversa.historico as unknown as BetaMessageParam[]
  // Impede que o cliente "falsifique" o bloco de contexto gerado pelo sistema
  const textoCliente = params.texto.replace(/<\/?contexto>/gi, '')
  const pedidosAntes = await prisma.pedido.count({ where: { conversaId: conversa.id } })

  try {
    const runner = anthropic().beta.messages.toolRunner({
      model: MODELO,
      max_tokens: 8000,
      output_config: { effort: 'low' }, // conversa curta guiada por ferramentas
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      cache_control: { type: 'ephemeral' }, // também reaproveita o histórico entre mensagens
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default', // se o modelo recusar por segurança, a API tenta outro modelo
      tools: criarFerramentas({ clienteId, conversaId: conversa.id }),
      max_iterations: 12,
      messages: [
        ...historico,
        {
          role: 'user',
          content: [
            { type: 'text', text: blocoDeContexto(params.nomePerfil, params.situacaoMenu) },
            { type: 'text', text: textoCliente },
          ],
        },
      ],
    })

    const final = await runner.runUntilDone()
    console.info(
      `[chatbot] IA conversa=${conversa.id} stop=${final.stop_reason} ` +
      `in=${final.usage.input_tokens} cache_read=${final.usage.cache_read_input_tokens ?? 0} out=${final.usage.output_tokens}`
    )

    // Só acrescenta ao histórico (nunca reescreve turnos antigos), como a API recomenda
    await prisma.conversa.update({
      where: { id: conversa.id },
      data: { historico: runner.params.messages as unknown as Prisma.InputJsonValue },
    })

    if (final.stop_reason === 'refusal') {
      await prisma.conversa.update({ where: { id: conversa.id }, data: { status: 'HUMANO' } })
      return { texto: MENSAGEM_ATENDENTE, criouPedido: false, chamouAtendente: true }
    }

    const texto = final.content
      .flatMap((b) => (b.type === 'text' ? [b.text] : []))
      .join('\n\n')
      .trim()
    if (!texto) return null

    const [pedidosDepois, atual] = await Promise.all([
      prisma.pedido.count({ where: { conversaId: conversa.id } }),
      prisma.conversa.findUniqueOrThrow({ where: { id: conversa.id }, select: { status: true } }),
    ])
    return { texto, criouPedido: pedidosDepois > pedidosAntes, chamouAtendente: atual.status === 'HUMANO' }
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      console.error(`[chatbot] erro da API da Anthropic (${e.status}):`, e.message)
    } else {
      console.error('[chatbot] erro ao gerar resposta da IA:', e)
    }
    return null
  }
}
