import { NextResponse } from 'next/server'
import { exigirSessao } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'

type Params = { params: { id: string } }

export async function GET(_req: Request, { params }: Params) {
  const session = await exigirSessao()
  if (session instanceof NextResponse) return session

  const conversa = await prisma.conversa.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      status: true,
      createdAt: true,
      ultimaMensagemEm: true,
      cliente: { select: { id: true, nome: true, telefone: true, endereco: true } },
      mensagens: { orderBy: { createdAt: 'asc' }, select: { id: true, direcao: true, texto: true, createdAt: true } },
      pedidos: { orderBy: { createdAt: 'desc' }, select: { id: true, status: true, valorTotal: true } },
    },
  })
  if (!conversa) return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })

  return NextResponse.json(conversa)
}

/** Assumir a conversa (HUMANO) ou devolvê-la ao atendimento automático (BOT). */
export async function PATCH(req: Request, { params }: Params) {
  const session = await exigirSessao()
  if (session instanceof NextResponse) return session

  const { status } = await req.json()
  if (!['BOT', 'HUMANO'].includes(status)) {
    return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
  }

  const atual = await prisma.conversa.findUnique({ where: { id: params.id } })
  if (!atual) return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })
  if (atual.status === 'ENCERRADA') {
    return NextResponse.json(
      { error: 'Conversa encerrada — a próxima mensagem do cliente abre uma nova' },
      { status: 409 }
    )
  }

  const conversa = await prisma.conversa.update({ where: { id: params.id }, data: { status } })
  return NextResponse.json(conversa)
}
