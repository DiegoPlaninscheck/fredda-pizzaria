import { NextResponse } from 'next/server'
import { enfileirar, enviarMensagens } from '@/lib/whatsapp'
import { assinaturaTwilioValida, extrairMensagemTwilio } from '@/lib/twilio'
import { atenderMensagem } from '@/lib/chatbot/atendimento'

// Rota pública (fora do middleware): quem autentica é a assinatura da Twilio.
export const dynamic = 'force-dynamic'

/**
 * URL que a Twilio chamou, usada na assinatura. Atrás do Caddy o app recebe
 * http://localhost; TWILIO_WEBHOOK_URL fixa a URL cadastrada no console.
 */
function urlPublica(req: Request) {
  if (process.env.TWILIO_WEBHOOK_URL) return process.env.TWILIO_WEBHOOK_URL
  const url = new URL(req.url)
  const proto = req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? url.host
  return `${proto}://${host}${url.pathname}${url.search}`
}

const TWIML_VAZIO = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'

/** Mensagens recebidas. Responde na hora (TwiML vazio) e envia as respostas pela API. */
export async function POST(req: Request) {
  const params = Object.fromEntries(new URLSearchParams(await req.text()))

  if (!assinaturaTwilioValida(urlPublica(req), params, req.headers.get('x-twilio-signature'))) {
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
  }

  const mensagem = extrairMensagemTwilio(params)
  if (mensagem) {
    enfileirar(mensagem.telefone, async () => {
      const saidas = await atenderMensagem(mensagem)
      await enviarMensagens(mensagem.telefone, saidas)
    }).catch((e) => console.error(`[whatsapp] erro ao processar mensagem de ${mensagem.telefone}:`, e))
  }

  // A Twilio espera TwiML; vazio = nenhuma resposta automática dela
  return new Response(TWIML_VAZIO, { headers: { 'Content-Type': 'text/xml' } })
}
