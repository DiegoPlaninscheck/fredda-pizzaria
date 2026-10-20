import { NextResponse } from 'next/server'
import { exigirSessao } from '@/lib/api-auth'
import { compararPlanos } from '@/lib/planejamento'

export async function GET(req: Request) {
  const session = await exigirSessao()
  if (session instanceof NextResponse) return session

  const limite = Math.min(Math.max(Number(new URL(req.url).searchParams.get('limite')) || 12, 1), 52)
  return NextResponse.json(await compararPlanos(limite))
}
