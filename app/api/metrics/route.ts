import { timingSafeEqual } from 'crypto'
import { metricas } from '@/lib/metricas'

// Coletada pelo Prometheus na rede interna do compose, com o cabeçalho
// "Authorization: Bearer <METRICS_TOKEN>". Sem METRICS_TOKEN configurado a rota
// não existe (404): as métricas nunca ficam abertas por esquecimento.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function tokenValido(cabecalho: string | null, esperado: string) {
  const recebido = Buffer.from(cabecalho?.replace(/^Bearer\s+/i, '') ?? '')
  const correto = Buffer.from(esperado)
  return recebido.length === correto.length && timingSafeEqual(recebido, correto)
}

export async function GET(req: Request) {
  const esperado = process.env.METRICS_TOKEN
  if (!esperado) return new Response('Not Found', { status: 404 })
  if (!tokenValido(req.headers.get('authorization'), esperado)) {
    return new Response('Unauthorized', { status: 401 })
  }

  return new Response(await metricas.registry.metrics(), {
    headers: { 'Content-Type': metricas.registry.contentType },
  })
}
