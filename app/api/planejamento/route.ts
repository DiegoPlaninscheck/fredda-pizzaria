import { NextResponse } from 'next/server'
import { Decimal } from '@prisma/client/runtime/library'
import { exigirSessao } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { semanaParaData, validarSemana } from '@/lib/semanas'

const incluirItens = {
  itens: { include: { receita: { select: { id: true, nome: true } } }, orderBy: { receita: { nome: 'asc' as const } } },
  usuario: { select: { nome: true } },
}

export async function GET(req: Request) {
  const session = await exigirSessao()
  if (session instanceof NextResponse) return session

  const semana = validarSemana(new URL(req.url).searchParams.get('semana'))
  if (!semana) return NextResponse.json({ error: 'Semana inválida (use a data de uma segunda-feira)' }, { status: 400 })

  const plano = await prisma.planoProducao.findUnique({
    where: { semana: semanaParaData(semana) },
    include: incluirItens,
  })
  return NextResponse.json(plano)
}

interface ItemEntrada {
  receitaId?: string
  previsao?: number | null
  limiteInferior?: number | null
  limiteSuperior?: number | null
  metodo?: string | null
  estoqueInicial?: number
  sugerido?: number
  planejado?: number
}

const opcional = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v))
const naoNegativo = (v: unknown) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0

/** Salva (cria ou substitui) o plano de produção de uma semana. */
export async function PUT(req: Request) {
  const session = await exigirSessao()
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const semana = validarSemana(body?.semana)
  if (!semana) return NextResponse.json({ error: 'Semana inválida (use a data de uma segunda-feira)' }, { status: 400 })

  const itens: ItemEntrada[] = Array.isArray(body?.itens) ? body.itens : []
  if (itens.length === 0) return NextResponse.json({ error: 'O plano precisa de ao menos um sabor' }, { status: 400 })

  const ids = new Set<string>()
  for (const i of itens) {
    if (!i.receitaId) return NextResponse.json({ error: 'Receita é obrigatória em cada item' }, { status: 400 })
    if (ids.has(i.receitaId)) return NextResponse.json({ error: 'Cada sabor deve aparecer apenas uma vez' }, { status: 400 })
    ids.add(i.receitaId)
    if (!naoNegativo(i.planejado) || !naoNegativo(i.sugerido) || !naoNegativo(i.estoqueInicial)) {
      return NextResponse.json({ error: 'Quantidades devem ser números maiores ou iguais a zero' }, { status: 400 })
    }
    for (const v of [i.previsao, i.limiteInferior, i.limiteSuperior]) {
      if (opcional(v) !== null && !naoNegativo(v)) {
        return NextResponse.json({ error: 'Previsão inválida' }, { status: 400 })
      }
    }
  }

  const encontradas = await prisma.receita.count({ where: { id: { in: Array.from(ids) } } })
  if (encontradas !== ids.size) return NextResponse.json({ error: 'Uma ou mais receitas não foram encontradas' }, { status: 404 })

  const dados = itens.map((i) => ({
    receitaId: i.receitaId!,
    previsao: opcional(i.previsao) === null ? null : new Decimal(Number(i.previsao)),
    limiteInferior: opcional(i.limiteInferior) === null ? null : new Decimal(Number(i.limiteInferior)),
    limiteSuperior: opcional(i.limiteSuperior) === null ? null : new Decimal(Number(i.limiteSuperior)),
    metodo: i.metodo?.toString().slice(0, 100) || null,
    estoqueInicial: new Decimal(Number(i.estoqueInicial)),
    sugerido: new Decimal(Number(i.sugerido)),
    planejado: new Decimal(Number(i.planejado)),
  }))

  const plano = await prisma.$transaction(async (tx) => {
    const salvo = await tx.planoProducao.upsert({
      where: { semana: semanaParaData(semana) },
      create: {
        semana: semanaParaData(semana),
        modeloAtivo: body.modeloAtivo?.toString().slice(0, 100) || null,
        observacoes: body.observacoes?.toString().trim().slice(0, 191) || null,
        usuarioId: session.user.id,
      },
      update: {
        modeloAtivo: body.modeloAtivo?.toString().slice(0, 100) || null,
        observacoes: body.observacoes?.toString().trim().slice(0, 191) || null,
        usuarioId: session.user.id,
      },
    })
    await tx.planoProducaoItem.deleteMany({ where: { planoId: salvo.id } })
    await tx.planoProducaoItem.createMany({ data: dados.map((d) => ({ ...d, planoId: salvo.id })) })
    return tx.planoProducao.findUnique({ where: { id: salvo.id }, include: incluirItens })
  })

  return NextResponse.json(plano)
}
