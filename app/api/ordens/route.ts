import { NextResponse } from 'next/server'
import { exigirSessao } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { NomeEtapa, StatusOrdem } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { baixarEstoqueInsumoAteODisponivel } from '@/lib/estoque'

const ETAPAS_PADRAO: { nome: NomeEtapa; ordem: number; duracaoMinutos: number }[] = [
  { nome: NomeEtapa.MISTURA,           ordem: 1, duracaoMinutos: 30   },
  { nome: NomeEtapa.DESCANSO_INICIAL,  ordem: 2, duracaoMinutos: 60   },
  { nome: NomeEtapa.FERMENTACAO_LONGA, ordem: 3, duracaoMinutos: 1440 },
  { nome: NomeEtapa.MODELAGEM,         ordem: 4, duracaoMinutos: 60   },
  { nome: NomeEtapa.CONGELAMENTO,      ordem: 5, duracaoMinutos: 720  },
]

export async function GET(req: Request) {
  const session = await exigirSessao()
  if (session instanceof NextResponse) return session

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const receitaId = searchParams.get('receitaId')

  if (status && !Object.values(StatusOrdem).includes(status as StatusOrdem)) {
    return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
  }

  const ordens = await prisma.ordemProducao.findMany({
    where: {
      status: status ? (status as StatusOrdem) : { not: 'CANCELADA' },
      receitas: receitaId ? { some: { receitaId } } : undefined,
    },
    orderBy: { createdAt: 'desc' },
    include: {
      receitas: { include: { receita: { select: { id: true, nome: true } } } },
      usuario: { select: { nome: true } },
      etapas: { orderBy: { ordem: 'asc' } },
    },
  })

  return NextResponse.json(ordens)
}

export async function POST(req: Request) {
  const session = await exigirSessao()
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { receitas, dataPrevista, observacoes } = body

  if (!Array.isArray(receitas) || receitas.length === 0) {
    return NextResponse.json({ error: 'Selecione ao menos uma receita' }, { status: 400 })
  }

  const itens: { receitaId: string; quantidade: InstanceType<typeof Decimal> }[] = []
  for (const item of receitas) {
    if (!item?.receitaId) return NextResponse.json({ error: 'Receita é obrigatória' }, { status: 400 })
    if (!item?.quantidade || Number(item.quantidade) <= 0) {
      return NextResponse.json({ error: 'Quantidade deve ser maior que zero' }, { status: 400 })
    }
    itens.push({ receitaId: item.receitaId, quantidade: new Decimal(item.quantidade) })
  }

  const idsUnicos = new Set(itens.map((i) => i.receitaId))
  if (idsUnicos.size !== itens.length) {
    return NextResponse.json({ error: 'Cada receita deve ser selecionada apenas uma vez' }, { status: 400 })
  }

  const receitasEncontradas = await prisma.receita.findMany({
    where: { id: { in: Array.from(idsUnicos) } },
    include: { insumos: { include: { insumo: true } } },
  })

  if (receitasEncontradas.length !== idsUnicos.size) {
    return NextResponse.json({ error: 'Uma ou mais receitas não foram encontradas' }, { status: 404 })
  }

  // Consumo total de cada insumo, somando todas as receitas da ordem
  const consumo = new Map<string, InstanceType<typeof Decimal>>()
  const usoPorInsumo = new Map<string, { nome: string; disponivel: InstanceType<typeof Decimal>; receitas: string[] }>()
  for (const item of itens) {
    const receita = receitasEncontradas.find((r) => r.id === item.receitaId)!
    for (const ri of receita.insumos) {
      const necessario = new Decimal(ri.quantidade).mul(item.quantidade)
      consumo.set(ri.insumoId, (consumo.get(ri.insumoId) ?? new Decimal(0)).add(necessario))
      const uso = usoPorInsumo.get(ri.insumoId) ?? { nome: ri.insumo.nome, disponivel: new Decimal(ri.insumo.estoqueAtual), receitas: [] }
      uso.receitas.push(receita.nome)
      usoPorInsumo.set(ri.insumoId, uso)
    }
  }

  // Aviso de falta pelo consumo total da ordem (não bloqueia a criação): cada receita
  // pode caber no estoque sozinha e, somadas, não caberem.
  const insuficientes = Array.from(usoPorInsumo)
    .filter(([insumoId, uso]) => uso.disponivel.lt(consumo.get(insumoId)!))
    .map(([insumoId, uso]) => ({
      receita: uso.receitas.join(', '),
      nome: uso.nome,
      necessario: consumo.get(insumoId)!.toFixed(3),
      disponivel: uso.disponivel.toFixed(3),
    }))

  const ordem = await prisma.$transaction(async (tx) => {
    const criada = await tx.ordemProducao.create({
      data: {
        usuarioId: session.user.id,
        dataPrevista: dataPrevista ? new Date(dataPrevista) : null,
        observacoes: observacoes?.trim() || null,
        receitas: {
          create: itens.map((i) => ({ receitaId: i.receitaId, quantidade: i.quantidade })),
        },
        etapas: { create: ETAPAS_PADRAO },
      },
      include: {
        receitas: { include: { receita: { select: { id: true, nome: true } } } },
        usuario: { select: { nome: true } },
        etapas: { orderBy: { ordem: 'asc' } },
      },
    })

    // Baixa o que houver de cada insumo — estoque insuficiente não bloqueia a ordem, só gera aviso.
    // O que foi baixado fica registrado na movimentação e é devolvido se a ordem for cancelada.
    for (const [insumoId, necessario] of Array.from(consumo)) {
      const baixado = await baixarEstoqueInsumoAteODisponivel(tx, insumoId, necessario)
      if (baixado.lte(0)) continue
      await tx.movimentacaoEstoque.create({
        data: {
          tipo: 'SAIDA',
          quantidade: baixado,
          motivo: `Ordem de produção ${criada.id.slice(-6).toUpperCase()}`,
          insumoId,
          usuarioId: session.user.id,
          ordemId: criada.id,
        },
      })
    }

    return criada
  })

  return NextResponse.json({ ...ordem, insuficientes }, { status: 201 })
}
