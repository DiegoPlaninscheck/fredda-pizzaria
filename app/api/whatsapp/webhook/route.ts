import { NextResponse } from 'next/server'
import { assinaturaValida, enfileirar, enviarMensagem, extrairMensagens, marcarComoLida } from '@/lib/whatsapp'
import { atenderMensagem } from '@/lib/chatbot/atendimento'

// Rota pública (fora do middleware): quem autentica é a assinatura da Meta.
export const dynamic = 'force-dynamic'

/** Verificação do webhook, feita uma vez pela Meta ao cadastrar a URL. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? '', { status: 200 })
  }
  return NextResponse.json({ error: 'Token de verificação inválido' }, { status: 403 })
}

/** Mensagens recebidas. Responde 200 na hora e processa em segundo plano. */
export async function POST(req: Request) {
  const corpoBruto = await req.text()

  if (!assinaturaValida(corpoBruto, req.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
  }

  let payload
  try {
    payload = JSON.parse(corpoBruto)
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  for (const mensagem of extrairMensagens(payload)) {
    enfileirar(mensagem.telefone, async () => {
      await marcarComoLida(mensagem.waMessageId)
      const saidas = await atenderMensagem(mensagem)
      for (const saida of saidas) await enviarMensagem(mensagem.telefone, saida)
    }).catch((e) => console.error(`[whatsapp] erro ao processar mensagem de ${mensagem.telefone}:`, e))
  }

  // A Meta reenvia o webhook se não receber 200 rápido; reenvios são ignorados pelo waMessageId.
  return NextResponse.json({ ok: true })
}
