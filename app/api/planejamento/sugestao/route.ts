import { NextResponse } from 'next/server'
import { exigirSessao } from '@/lib/api-auth'
import { gerarSugestao, semanasPlanejaveis } from '@/lib/planejamento'
import { validarSemana } from '@/lib/semanas'

export async function GET(req: Request) {
  const session = await exigirSessao()
  if (session instanceof NextResponse) return session

  const { primeira, ultima } = semanasPlanejaveis()
  const param = new URL(req.url).searchParams.get('semana')
  const semana = param ? validarSemana(param) : primeira
  if (!semana) return NextResponse.json({ error: 'Semana inválida (use a data de uma segunda-feira)' }, { status: 400 })
  if (semana < primeira || semana > ultima) {
    return NextResponse.json({ error: 'Só é possível gerar sugestão a partir da próxima semana e até 7 semanas à frente' }, { status: 400 })
  }

  return NextResponse.json(await gerarSugestao(semana))
}
