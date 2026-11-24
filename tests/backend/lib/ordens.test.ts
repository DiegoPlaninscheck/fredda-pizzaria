import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { OrdemFinalizadaError, cancelarOrdem, concluirOrdem } from '@/lib/ordens'
import { criarInsumo, criarReceita, criarUsuario, decimal } from '../helpers/db'

/** Ordem com duas receitas e uma baixa de insumo registrada, como a rota de criação faz. */
async function cenario() {
  const usuario = await criarUsuario()
  const farinha = await criarInsumo({ estoque: 4 }) // já descontados os 6 kg da ordem
  const margherita = await criarReceita({ estoque: 1 })
  const calabrese = await criarReceita({ estoque: 0 })
  const ordem = await prisma.ordemProducao.create({
    data: {
      usuarioId: usuario.id,
      receitas: { create: [{ receitaId: margherita.id, quantidade: 10 }, { receitaId: calabrese.id, quantidade: 5 }] },
      etapas: {
        create: [
          { nome: 'MISTURA', ordem: 1, duracaoMinutos: 30, status: 'CONCLUIDA', minutosDecorridos: 30 },
          { nome: 'DESCANSO_INICIAL', ordem: 2, duracaoMinutos: 60, status: 'EM_ANDAMENTO', iniciadaEm: new Date(Date.now() - 20 * 60000), minutosDecorridos: 5 },
          { nome: 'FERMENTACAO_LONGA', ordem: 3, duracaoMinutos: 1440 },
        ],
      },
      movimentacoes: {
        create: [{ tipo: 'SAIDA', quantidade: 6, insumoId: farinha.id, usuarioId: usuario.id }],
      },
    },
  })
  return { usuario, farinha, margherita, calabrese, ordem }
}

describe('concluir ordem de produção', () => {
  it('soma as quantidades produzidas ao estoque de produto pronto de cada sabor', async () => {
    const { ordem, margherita, calabrese } = await cenario()
    await prisma.$transaction((tx) => concluirOrdem(tx, ordem.id))

    expect(decimal((await prisma.receita.findUniqueOrThrow({ where: { id: margherita.id } })).estoqueAtual)).toBe(11)
    expect(decimal((await prisma.receita.findUniqueOrThrow({ where: { id: calabrese.id } })).estoqueAtual)).toBe(5)
    expect((await prisma.ordemProducao.findUniqueOrThrow({ where: { id: ordem.id } })).status).toBe('CONCLUIDA')
  })

  it('fecha as etapas abertas, somando o tempo da etapa que estava em andamento', async () => {
    const { ordem } = await cenario()
    await prisma.$transaction((tx) => concluirOrdem(tx, ordem.id))

    const etapas = await prisma.etapaFermentacao.findMany({ where: { ordemId: ordem.id }, orderBy: { ordem: 'asc' } })
    expect(etapas.every((e) => e.status === 'CONCLUIDA')).toBe(true)
    expect(etapas[0].concluidaEm).toBeNull() // já estava concluída: não é tocada
    expect(etapas[1].concluidaEm).not.toBeNull()
    expect(etapas[2].concluidaEm).not.toBeNull()
    expect(etapas[2].minutosDecorridos).toBe(0) // pendente: não acumula tempo
    expect(etapas[1].minutosDecorridos).toBe(25) // 5 já contados + 20 em andamento
    expect(etapas[1].iniciadaEm).toBeNull()
  })

  it('não conclui duas vezes (não repõe o estoque em dobro)', async () => {
    const { ordem, margherita } = await cenario()
    await prisma.$transaction((tx) => concluirOrdem(tx, ordem.id))
    await expect(prisma.$transaction((tx) => concluirOrdem(tx, ordem.id))).rejects.toBeInstanceOf(OrdemFinalizadaError)
    expect(decimal((await prisma.receita.findUniqueOrThrow({ where: { id: margherita.id } })).estoqueAtual)).toBe(11)
  })
})

describe('cancelar ordem de produção', () => {
  it('devolve ao estoque os insumos baixados na criação e registra o estorno', async () => {
    const { ordem, farinha, usuario } = await cenario()
    await prisma.$transaction((tx) => cancelarOrdem(tx, ordem.id, usuario.id))

    expect(decimal((await prisma.insumo.findUniqueOrThrow({ where: { id: farinha.id } })).estoqueAtual)).toBe(10)
    const estorno = await prisma.movimentacaoEstoque.findFirstOrThrow({ where: { ordemId: ordem.id, tipo: 'ENTRADA' } })
    expect(decimal(estorno.quantidade)).toBe(6)
    expect(estorno.motivo).toMatch(/Estorno — ordem de produção .* cancelada/)
  })

  it('pausa a etapa em andamento e não mexe no produto pronto', async () => {
    const { ordem, usuario, margherita } = await cenario()
    await prisma.$transaction((tx) => cancelarOrdem(tx, ordem.id, usuario.id))

    const etapa = await prisma.etapaFermentacao.findFirstOrThrow({ where: { ordemId: ordem.id, nome: 'DESCANSO_INICIAL' } })
    expect(etapa.status).toBe('PAUSADA')
    expect(etapa.minutosDecorridos).toBe(25)
    expect(decimal((await prisma.receita.findUniqueOrThrow({ where: { id: margherita.id } })).estoqueAtual)).toBe(1)
    expect((await prisma.ordemProducao.findUniqueOrThrow({ where: { id: ordem.id } })).status).toBe('CANCELADA')
  })

  it('ordem já concluída não pode ser cancelada', async () => {
    const { ordem, usuario } = await cenario()
    await prisma.$transaction((tx) => concluirOrdem(tx, ordem.id))
    await expect(prisma.$transaction((tx) => cancelarOrdem(tx, ordem.id, usuario.id)))
      .rejects.toThrow('Ordem já foi concluída ou cancelada')
  })
})
