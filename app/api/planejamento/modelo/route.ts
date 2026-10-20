import { NextResponse } from 'next/server'
import { exigirSessao } from '@/lib/api-auth'
import { IAIndisponivelError, infoModelo, treinarModelo } from '@/lib/ia'

// Retreinar faz busca de hiperparâmetros e pode levar alguns minutos
export const maxDuration = 600

function erroIA(e: unknown) {
  if (e instanceof IAIndisponivelError) return NextResponse.json({ error: e.message }, { status: 503 })
  throw e
}

/** Metadados e métricas do modelo ativo. */
export async function GET() {
  const session = await exigirSessao()
  if (session instanceof NextResponse) return session

  try {
    return NextResponse.json(await infoModelo())
  } catch (e) {
    return erroIA(e)
  }
}

/** Retreina o modelo com o histórico de vendas atual (somente ADMIN). */
export async function POST() {
  const session = await exigirSessao('ADMIN')
  if (session instanceof NextResponse) return session

  try {
    return NextResponse.json(await treinarModelo())
  } catch (e) {
    return erroIA(e)
  }
}
