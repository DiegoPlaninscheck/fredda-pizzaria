import { NextResponse } from 'next/server'
import { StatusPedido } from '@prisma/client'
import { exigirSessao } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { incluirPedido } from '@/lib/pedidos'

export async function GET(req: Request) {
  const session = await exigirSessao()
  if (session instanceof NextResponse) return session

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  // Sem filtro: pedidos em aberto (aguardando confirmação ou confirmados)
  let filtroStatus: StatusPedido[] = ['PENDENTE', 'CONFIRMADO']
  if (status === 'TODOS') filtroStatus = Object.values(StatusPedido)
  else if (status) {
    if (!Object.values(StatusPedido).includes(status as StatusPedido)) {
      return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
    }
    filtroStatus = [status as StatusPedido]
  }

  const pedidos = await prisma.pedido.findMany({
    where: { status: { in: filtroStatus } },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: incluirPedido,
  })

  return NextResponse.json(pedidos)
}
