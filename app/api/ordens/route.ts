import { NextResponse } from 'next/server'
import { exigirSessao } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { NomeEtapa, StatusOrdem } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { baixarEstoqueInsumo, EstoqueInsuficienteError } from '@/lib/estoque'

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
<<<<<<< Updated upstream
      status: status ? (status as never) : { not: 'CANCELADA' },
      receitas: receitaId ? { some: { receitaId } } : undefined,
=======
      status: status ? (status as StatusOrdem) : { not: 'CANCELADA' },
      receitaId: receitaId || undefined,
>>>>>>> Stashed changes
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

  // Verifica estoque dos insumos apenas para gerar aviso — não bloqueia a criação da ordem
  const insuficientes: { receita: string; nome: string; necessario: string; disponivel: string }[] = []
  for (const item of itens) {
    const receita = receitasEncontradas.find((r) => r.id === item.receitaId)!
    for (const ri of receita.insumos) {
      const necessario = new Decimal(ri.quantidade).mul(item.quantidade)
      const disponivel = new Decimal(ri.insumo.estoqueAtual)
      if (disponivel.lt(necessario)) {
        insuficientes.push({
          receita: receita.nome,
          nome: ri.insumo.nome,
          necessario: necessario.toFixed(3),
          disponivel: disponivel.toFixed(3),
        })
      }
    }
  }

<<<<<<< Updated upstream
  const ordem = await prisma.ordemProducao.create({
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

  return NextResponse.json({ ...ordem, insuficientes }, { status: 201 })
=======
  try {
    const ordem = await prisma.$transaction(async (tx) => {
      const criada = await tx.ordemProducao.create({
        data: {
          receitaId,
          usuarioId: session.user.id,
          quantidade: qtd,
          dataPrevista: dataPrevista ? new Date(dataPrevista) : null,
          observacoes: observacoes?.trim() || null,
          etapas: { create: ETAPAS_PADRAO },
        },
        include: {
          receita: { select: { id: true, nome: true } },
          usuario: { select: { nome: true } },
          etapas: { orderBy: { ordem: 'asc' } },
        },
      })

      // Baixa dos insumos consumidos pela ordem (estornada se a ordem for cancelada)
      for (const ri of receita.insumos) {
        const necessario = new Decimal(ri.quantidade).mul(qtd)
        await baixarEstoqueInsumo(tx, ri.insumoId, necessario)
        await tx.movimentacaoEstoque.create({
          data: {
            tipo: 'SAIDA',
            quantidade: necessario,
            motivo: `Ordem de produção ${criada.id.slice(-6).toUpperCase()} — ${receita.nome}`,
            insumoId: ri.insumoId,
            usuarioId: session.user.id,
            ordemId: criada.id,
          },
        })
      }

      return criada
    })

    return NextResponse.json(ordem, { status: 201 })
  } catch (e) {
    if (e instanceof EstoqueInsuficienteError) {
      return NextResponse.json({ error: e.message }, { status: 422 })
    }
    throw e
  }
>>>>>>> Stashed changes
}
