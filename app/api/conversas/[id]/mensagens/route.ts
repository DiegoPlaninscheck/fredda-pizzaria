import { NextResponse } from 'next/server'
import { exigirSessao } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { notificarCliente } from '@/lib/chatbot/notificar'

/** Resposta manual da equipe ao cliente, pelo painel. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await exigirSessao()
  if (session instanceof NextResponse) return session

  const { texto } = await req.json()
  if (!texto?.trim()) return NextResponse.json({ error: 'Escreva a mensagem' }, { status: 400 })

  const conversa = await prisma.conversa.findUnique({ where: { id: params.id } })
  if (!conversa) return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })

  const resultado = await notificarCliente(conversa.clienteId, texto.trim())
  if (resultado === 'fora_da_janela') {
    return NextResponse.json(
      { error: 'O cliente não mandou mensagem nas últimas 24h. Fora dessa janela o WhatsApp só permite enviar templates aprovados pela Meta.' },
      { status: 422 }
    )
  }

  return NextResponse.json({ ok: true })
}
