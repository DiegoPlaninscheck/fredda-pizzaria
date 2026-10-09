import crypto from 'crypto'
import type { MensagemSaida } from '@/lib/chatbot/mensagens'

const GRAPH_API = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || 'v23.0'}`
const LIMITE_TEXTO = 4096 // limite da Cloud API por mensagem

export function whatsappConfigurado() {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
}

/** Clientes criados pelo simulador do painel usam telefones começando com 000. */
export function ehTelefoneSimulado(telefone: string) {
  return telefone.startsWith('000')
}

function podeEnviar(para: string, descricao: string) {
  if (ehTelefoneSimulado(para)) return false
  if (!whatsappConfigurado()) {
    console.warn(`[whatsapp] não configurado — mensagem para ${para} não enviada:\n${descricao}`)
    return false
  }
  return true
}

async function chamarGraphApi(corpo: Record<string, unknown>) {
  const res = await fetch(`${GRAPH_API}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...corpo }),
  })
  if (!res.ok) {
    throw new Error(`WhatsApp API respondeu ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

/** Envia uma mensagem de texto (quebrando em partes se passar do limite da API). */
export async function enviarTexto(para: string, texto: string) {
  if (!podeEnviar(para, texto)) return
  for (let i = 0; i < texto.length; i += LIMITE_TEXTO) {
    await chamarGraphApi({
      to: para,
      type: 'text',
      text: { body: texto.slice(i, i + LIMITE_TEXTO), preview_url: false },
    })
  }
}

/** Envia uma mensagem do atendimento automático (texto, botões ou lista). */
export async function enviarMensagem(para: string, msg: MensagemSaida) {
  if (msg.tipo === 'texto') return enviarTexto(para, msg.texto)
  if (!podeEnviar(para, msg.texto)) return

  const action =
    msg.tipo === 'botoes'
      ? { buttons: msg.botoes.map((b) => ({ type: 'reply', reply: { id: b.id, title: b.titulo } })) }
      : {
          button: msg.botao,
          sections: [{
            title: 'Opções',
            rows: msg.opcoes.map((o) => ({ id: o.id, title: o.titulo, description: o.descricao })),
          }],
        }

  await chamarGraphApi({
    to: para,
    type: 'interactive',
    interactive: {
      type: msg.tipo === 'botoes' ? 'button' : 'list',
      body: { text: msg.texto },
      action,
    },
  })
}

/** Marca a mensagem como lida (os "dois tiques azuis" para o cliente). */
export async function marcarComoLida(waMessageId: string) {
  if (!whatsappConfigurado()) return
  await chamarGraphApi({ status: 'read', message_id: waMessageId }).catch((e) =>
    console.warn('[whatsapp] falha ao marcar como lida:', e.message)
  )
}

/** Confere o cabeçalho X-Hub-Signature-256 (HMAC-SHA256 do corpo bruto com o App Secret). */
export function assinaturaValida(corpoBruto: string, assinatura: string | null) {
  const segredo = process.env.WHATSAPP_APP_SECRET
  if (!segredo || !assinatura?.startsWith('sha256=')) return false

  const esperado = Buffer.from(
    'sha256=' + crypto.createHmac('sha256', segredo).update(corpoBruto, 'utf8').digest('hex')
  )
  const recebido = Buffer.from(assinatura)
  return esperado.length === recebido.length && crypto.timingSafeEqual(esperado, recebido)
}

export interface MensagemWhatsAppRecebida {
  waMessageId: string
  telefone: string
  nomePerfil?: string
  texto: string
  /** id da opção quando o cliente toca em um botão ou item de lista */
  respostaId?: string
}

interface PayloadWebhook {
  entry?: {
    changes?: {
      field?: string
      value?: {
        contacts?: { wa_id: string; profile?: { name?: string } }[]
        messages?: {
          id: string
          from: string
          type: string
          text?: { body: string }
          button?: { text: string }
          interactive?: {
            button_reply?: { id: string; title: string }
            list_reply?: { id: string; title: string }
          }
        }[]
      }
    }[]
  }[]
}

/**
 * Extrai as mensagens recebidas do payload do webhook. Atualizações de status
 * (enviada/entregue/lida) são ignoradas. Mensagens que não são texto viram uma
 * descrição para o bot responder com educação que só entende texto.
 */
export function extrairMensagens(payload: PayloadWebhook): MensagemWhatsAppRecebida[] {
  const mensagens: MensagemWhatsAppRecebida[] = []

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages' || !change.value?.messages) continue
      const contatos = change.value.contacts ?? []

      for (const m of change.value.messages) {
        const resposta = m.interactive?.button_reply ?? m.interactive?.list_reply
        const texto =
          m.text?.body ??
          m.button?.text ??
          resposta?.title ??
          `[O cliente enviou uma mensagem do tipo "${m.type}", que não consigo ler. Peça para ele escrever em texto.]`

        mensagens.push({
          waMessageId: m.id,
          telefone: m.from,
          nomePerfil: contatos.find((c) => c.wa_id === m.from)?.profile?.name,
          texto,
          respostaId: resposta?.id,
        })
      }
    }
  }
  return mensagens
}

// Fila por telefone: tudo que mexe na conversa de um cliente (mensagens dele,
// respostas da equipe, avisos de status) roda em ordem, uma tarefa por vez.
// Fica em memória — funciona porque o app roda como uma única instância na VPS.
const filas = new Map<string, Promise<void>>()

export function enfileirar<T>(telefone: string, tarefa: () => Promise<T>): Promise<T> {
  const anterior = filas.get(telefone) ?? Promise.resolve()
  const resultado = anterior.then(tarefa)
  const cauda = resultado.then(() => undefined, () => undefined)
  filas.set(telefone, cauda)
  cauda.then(() => {
    if (filas.get(telefone) === cauda) filas.delete(telefone)
  })
  return resultado
}
