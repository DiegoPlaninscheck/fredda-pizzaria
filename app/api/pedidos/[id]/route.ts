import { NextResponse } from 'next/server'
import { exigirSessao } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import {
  cancelarPedido, confirmarPedido, entregarPedido, incluirPedido, mensagemDeStatus, PedidoError,
} from '@/lib/pedidos'
import { notificarCliente } from '@/lib/chatbot/notificar'

type Params = { params: { id: string } }

export async function GET(_req: Request, { params }: Params) {
  const session = await exigirSessao()
  if (session instanceof NextResponse) return session

  const pedido = await prisma.pedido.findUnique({
    where: { id: Number(params.id) || 0 },
    include: {
      ...incluirPedido,
      conversa: {
        select: {
          id: true,
          status: true,
          mensagens: { orderBy: { createdAt: 'asc' }, select: { id: true, direcao: true, texto: true, createdAt: true } },
        },
      },
    },
  })
  if (!pedido) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })

  return NextResponse.json(pedido)
}

/** Muda o status do pedido e avisa o cliente pelo WhatsApp. */
export async function PATCH(req: Request, { params }: Params) {
  const session = await exigirSessao()
  if (session instanceof NextResponse) return session

  const id = Number(params.id)
  const { status } = await req.json()

  try {
    let pedido
    if (status === 'CONFIRMADO') pedido = await confirmarPedido(id, session.user.id)
    else if (status === 'ENTREGUE') pedido = await entregarPedido(id)
    else if (status === 'CANCELADO') pedido = await cancelarPedido(id)
    else return NextResponse.json({ error: 'Status inválido' }, { status: 400 })

    // A mudança já foi gravada; uma falha no WhatsApp não deve desfazê-la
    let notificacao = 'nao_aplicavel'
    if (pedido.canal === 'WHATSAPP') {
      notificacao = await notificarCliente(pedido.clienteId, mensagemDeStatus(pedido)).catch((e) => {
        console.error('[pedidos] falha ao notificar cliente:', e)
        return 'erro'
      })
    }

    return NextResponse.json({ pedido, notificacao })
  } catch (e) {
    if (e instanceof PedidoError) return NextResponse.json({ error: e.message }, { status: 409 })
    throw e
  }
}
