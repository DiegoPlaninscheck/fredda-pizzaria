import crypto from 'crypto'
import { normalizar } from '@/lib/chatbot/fluxo'
import type { MensagemSaida, Opcao } from '@/lib/chatbot/mensagens'

// Adaptador do WhatsApp via Twilio (Sandbox). Diferenças em relação à Cloud API da Meta:
// - o webhook chega como formulário (x-www-form-urlencoded), assinado com HMAC-SHA1;
// - mensagens livres não têm botões nem listas: as opções viram uma lista numerada
//   e o cliente responde com o número.

const API_TWILIO = 'https://api.twilio.com/2010-04-01'
const LIMITE_TEXTO = 1600 // limite do Body na API de mensagens da Twilio
const NUMERO_SANDBOX = 'whatsapp:+14155238886'

export function twilioConfigurado() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
}

async function chamarApiTwilio(para: string, corpo: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID!
  const res = await fetch(`${API_TWILIO}/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      From: process.env.TWILIO_WHATSAPP_FROM || NUMERO_SANDBOX,
      To: `whatsapp:+${para}`,
      Body: corpo,
    }),
  })
  if (!res.ok) {
    throw new Error(`Twilio respondeu ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

export async function enviarTextoTwilio(para: string, texto: string) {
  for (let i = 0; i < texto.length; i += LIMITE_TEXTO) {
    await chamarApiTwilio(para, texto.slice(i, i + LIMITE_TEXTO))
  }
}

// Últimas opções mostradas a cada cliente, para traduzir "2" na opção escolhida.
// Fica em memória, como a fila de lib/whatsapp.ts (uma única instância na VPS);
// se o app reiniciar, o número digitado segue como texto comum para o fluxo.
const opcoesMostradas = new Map<string, Opcao[]>()

const NUMEROS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']
const marcador = (i: number) => NUMEROS[i] ?? `${i + 1}.`

/**
 * Junta as mensagens de uma resposta em um texto só, com as opções numeradas
 * em sequência, e guarda as opções para interpretar a resposta do cliente.
 */
export async function enviarMensagensTwilio(para: string, msgs: MensagemSaida[]) {
  const opcoes: Opcao[] = []
  const partes = msgs.map((msg) => {
    if (msg.tipo === 'texto') return msg.texto
    const itens = msg.tipo === 'botoes' ? msg.botoes : msg.opcoes
    const linhas = itens.map((o) => {
      const linha = `${marcador(opcoes.length)} ${o.titulo}${o.descricao ? ` — ${o.descricao}` : ''}`
      opcoes.push(o)
      return linha
    })
    return `${msg.texto}\n\n${linhas.join('\n')}`
  })
  if (partes.length === 0) return

  if (opcoes.length > 0) {
    opcoesMostradas.set(para, opcoes)
    partes.push('_Responda com o número da opção._')
  } else {
    opcoesMostradas.delete(para)
  }
  await enviarTextoTwilio(para, partes.join('\n\n'))
}

/** Número ou título de uma das últimas opções mostradas → a opção escolhida. */
function opcaoEscolhida(telefone: string, texto: string): Opcao | undefined {
  const opcoes = opcoesMostradas.get(telefone)
  if (!opcoes) return undefined
  const t = normalizar(texto)
  if (/^\d{1,2}$/.test(t)) return opcoes[Number(t) - 1]
  return opcoes.find((o) => normalizar(o.titulo) === t)
}

/**
 * Confere o cabeçalho X-Twilio-Signature: HMAC-SHA1, com o Auth Token, da URL
 * pública do webhook seguida dos parâmetros do POST em ordem alfabética.
 */
export function assinaturaTwilioValida(url: string, params: Record<string, string>, assinatura: string | null) {
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!token || !assinatura) return false

  const dados = url + Object.keys(params).sort().map((k) => k + params[k]).join('')
  const esperado = Buffer.from(crypto.createHmac('sha1', token).update(dados, 'utf8').digest('base64'))
  const recebido = Buffer.from(assinatura)
  return esperado.length === recebido.length && crypto.timingSafeEqual(esperado, recebido)
}

export interface MensagemTwilioRecebida {
  waMessageId: string
  telefone: string
  nomePerfil?: string
  texto: string
  respostaId?: string
}

/** Converte o formulário do webhook da Twilio na mensagem usada pelo atendimento. */
export function extrairMensagemTwilio(params: Record<string, string>): MensagemTwilioRecebida | null {
  const telefone = params.WaId || params.From?.replace(/^whatsapp:\+?/, '')
  if (!params.MessageSid || !telefone) return null

  const corpo = params.Body?.trim()
  const texto = corpo
    ? corpo
    : `[O cliente enviou uma mensagem que não é texto${Number(params.NumMedia) > 0 ? ' (mídia)' : ''}, que não consigo ler. Peça para ele escrever em texto.]`
  const opcao = corpo ? opcaoEscolhida(telefone, corpo) : undefined

  return {
    // Reenvios da Twilio repetem o MessageSid; o prefixo evita colisão com ids da Meta
    waMessageId: `twilio:${params.MessageSid}`,
    telefone,
    nomePerfil: params.ProfileName || undefined,
    texto: opcao ? opcao.titulo : texto,
    respostaId: opcao?.id,
  }
}
