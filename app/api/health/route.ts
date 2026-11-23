import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Health check público, usado pelo smoke test do pipeline de deploy e por monitores
// de disponibilidade. Não expõe detalhes internos: só diz se o app e o banco respondem.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok', db: 'ok' })
  } catch {
    return NextResponse.json({ status: 'erro', db: 'indisponivel' }, { status: 503 })
  }
}
