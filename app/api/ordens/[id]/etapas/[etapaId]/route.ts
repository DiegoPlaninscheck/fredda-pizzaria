import { NextResponse } from 'next/server'
import { exigirSessao } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { concluirOrdem, OrdemFinalizadaError, STATUS_FINAIS } from '@/lib/ordens'

type Params = { params: { id: string; etapaId: string } }

export async function PATCH(req: Request, { params }: Params) {
  const session = await exigirSessao()
  if (session instanceof NextResponse) return session

  const { acao } = await req.json()

  if (!['INICIAR', 'PAUSAR', 'CONCLUIR'].includes(acao)) {
    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  }

  const etapa = await prisma.etapaFermentacao.findUnique({
    where: { id: params.etapaId },
    include: { ordem_producao: { include: { receitas: true } } },
  })

  if (!etapa || etapa.ordemId !== params.id) {
    return NextResponse.json({ error: 'Etapa não encontrada' }, { status: 404 })
  }

  if (STATUS_FINAIS.includes(etapa.ordem_producao.status)) {
    return NextResponse.json({ error: 'Ordem já foi concluída ou cancelada' }, { status: 409 })
  }

  const agora = new Date()

  if (acao === 'INICIAR') {
    if (etapa.status === 'EM_ANDAMENTO') {
      return NextResponse.json({ error: 'Etapa já está em andamento' }, { status: 409 })
    }

    const outraAtiva = await prisma.etapaFermentacao.findFirst({
      where: { ordemId: params.id, status: 'EM_ANDAMENTO' },
    })
    if (outraAtiva) {
      return NextResponse.json({ error: 'Outra etapa já está em andamento nesta ordem' }, { status: 409 })
    }

    await prisma.$transaction([
      prisma.etapaFermentacao.update({
        where: { id: params.etapaId },
        data: { status: 'EM_ANDAMENTO', iniciadaEm: agora },
      }),
      prisma.ordemProducao.update({
        where: { id: params.id },
        data: {
          status: etapa.ordem_producao.status === 'PLANEJADA' ? 'EM_ANDAMENTO' : undefined,
        },
      }),
    ])
  }

  if (acao === 'PAUSAR') {
    if (etapa.status !== 'EM_ANDAMENTO' || !etapa.iniciadaEm) {
      return NextResponse.json({ error: 'Etapa não está em andamento' }, { status: 409 })
    }

    const minutos = (agora.getTime() - etapa.iniciadaEm.getTime()) / 60000
    await prisma.etapaFermentacao.update({
      where: { id: params.etapaId },
      data: {
        status: 'PAUSADA',
        minutosDecorridos: etapa.minutosDecorridos + Math.round(minutos),
        iniciadaEm: null,
      },
    })
    await prisma.ordemProducao.update({ where: { id: params.id }, data: { status: 'PAUSADA' } })
  }

  if (acao === 'CONCLUIR') {
    if (!['EM_ANDAMENTO', 'PAUSADA'].includes(etapa.status)) {
      return NextResponse.json({ error: 'Etapa não pode ser concluída neste estado' }, { status: 409 })
    }

    let totalMinutos = etapa.minutosDecorridos
    if (etapa.status === 'EM_ANDAMENTO' && etapa.iniciadaEm) {
      totalMinutos += Math.round((agora.getTime() - etapa.iniciadaEm.getTime()) / 60000)
    }

    await prisma.etapaFermentacao.update({
      where: { id: params.etapaId },
      data: {
        status: 'CONCLUIDA',
        minutosDecorridos: totalMinutos,
        iniciadaEm: null,
        concluidaEm: agora,
      },
    })

    // Verifica se todas as etapas foram concluídas
    const pendentes = await prisma.etapaFermentacao.count({
      where: { ordemId: params.id, status: { not: 'CONCLUIDA' } },
    })

    if (pendentes === 0) {
<<<<<<< Updated upstream
      await prisma.$transaction([
        prisma.ordemProducao.update({
          where: { id: params.id },
          data: { status: 'CONCLUIDA' },
        }),
        ...etapa.ordem_producao.receitas.map((r) =>
          prisma.receita.update({
            where: { id: r.receitaId },
            data: { estoqueAtual: { increment: r.quantidade } },
          })
        ),
      ])
=======
      try {
        await prisma.$transaction((tx) => concluirOrdem(tx, params.id))
      } catch (e) {
        if (e instanceof OrdemFinalizadaError) {
          return NextResponse.json({ error: e.message }, { status: 409 })
        }
        throw e
      }
>>>>>>> Stashed changes
    } else {
      await prisma.ordemProducao.update({
        where: { id: params.id },
        data: { status: 'EM_ANDAMENTO' },
      })
    }
  }

  const etapaAtualizada = await prisma.etapaFermentacao.findUnique({
    where: { id: params.etapaId },
    include: { registros: { orderBy: { createdAt: 'desc' } } },
  })

  return NextResponse.json(etapaAtualizada)
}
