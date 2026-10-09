import { NextResponse } from 'next/server'
import { exigirSessao } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { atenderMensagem } from '@/lib/chatbot/atendimento'
import { iaDisponivel } from '@/lib/chatbot/agente'
import { ehTelefoneSimulado, enfileirar } from '@/lib/whatsapp'

/**
 * Simulador do atendimento (tela /pedidos/simulador): processa a mensagem
 * exatamente como o webhook faria, mas devolve as respostas em vez de enviá-las
 * pelo WhatsApp. Só aceita telefones de teste (começando com 000).
 */
export async function POST(req: Request) {
  const session = await exigirSessao()
  if (session instanceof NextResponse) return session

  const { telefone, texto, respostaId, novaConversa } = await req.json()

  if (typeof telefone !== 'string' || !/^\d+$/.test(telefone) || !ehTelefoneSimulado(telefone)) {
    return NextResponse.json({ error: 'Use um telefone de teste começando com 000 (só números)' }, { status: 400 })
  }

  if (novaConversa) {
    const cliente = await prisma.cliente.findUnique({ where: { telefone } })
    if (cliente) {
      await prisma.conversa.updateMany({
        where: { clienteId: cliente.id, status: { not: 'ENCERRADA' } },
        data: { status: 'ENCERRADA' },
      })
    }
    return NextResponse.json({ saidas: [], iaDisponivel: iaDisponivel() })
  }

  if (typeof texto !== 'string' || !texto.trim()) {
    return NextResponse.json({ error: 'Escreva uma mensagem' }, { status: 400 })
  }

  const saidas = await enfileirar(telefone, () =>
    atenderMensagem({
      telefone,
      texto: texto.trim(),
      respostaId: typeof respostaId === 'string' ? respostaId : undefined,
      nomePerfil: 'Cliente Teste',
    })
  )

  return NextResponse.json({ saidas, iaDisponivel: iaDisponivel() })
}
