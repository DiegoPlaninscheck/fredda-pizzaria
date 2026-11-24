import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  EstoqueInsuficienteError, baixarEstoqueInsumo, baixarEstoqueInsumoAteODisponivel,
  baixarEstoqueReceita, formatarQuantidade, reporEstoqueReceita,
} from '@/lib/estoque'
import { criarInsumo, criarReceita, decimal } from '../helpers/db'

const estoqueDaReceita = async (id: string) =>
  decimal((await prisma.receita.findUniqueOrThrow({ where: { id } })).estoqueAtual)
const estoqueDoInsumo = async (id: string) =>
  decimal((await prisma.insumo.findUniqueOrThrow({ where: { id } })).estoqueAtual)

describe('estoque de produto pronto (receitas)', () => {
  it('baixa a quantidade quando há saldo', async () => {
    const receita = await criarReceita({ estoque: 10 })
    await prisma.$transaction((tx) => baixarEstoqueReceita(tx, receita.id, 4))
    expect(await estoqueDaReceita(receita.id)).toBe(6)
  })

  it('permite zerar o estoque, mas não passar de zero', async () => {
    const receita = await criarReceita({ nome: 'Margherita', estoque: 3 })
    await prisma.$transaction((tx) => baixarEstoqueReceita(tx, receita.id, 3))
    expect(await estoqueDaReceita(receita.id)).toBe(0)

    await expect(prisma.$transaction((tx) => baixarEstoqueReceita(tx, receita.id, 1)))
      .rejects.toThrow(new EstoqueInsuficienteError('Estoque insuficiente de Margherita. Disponível: 0'))
    expect(await estoqueDaReceita(receita.id)).toBe(0)
  })

  it('com saldo insuficiente lança erro e desfaz a transação inteira', async () => {
    const a = await criarReceita({ estoque: 5 })
    const b = await criarReceita({ estoque: 1 })
    await expect(prisma.$transaction(async (tx) => {
      await baixarEstoqueReceita(tx, a.id, 2) // esta baixa daria certo...
      await baixarEstoqueReceita(tx, b.id, 2) // ...mas esta falha e desfaz as duas
    })).rejects.toBeInstanceOf(EstoqueInsuficienteError)

    expect(await estoqueDaReceita(a.id)).toBe(5)
    expect(await estoqueDaReceita(b.id)).toBe(1)
  })

  it('duas baixas simultâneas com saldo para uma só: exatamente uma vence e o estoque nunca fica negativo', async () => {
    const receita = await criarReceita({ estoque: 8 })

    const resultados = await Promise.allSettled([
      prisma.$transaction((tx) => baixarEstoqueReceita(tx, receita.id, 5)),
      prisma.$transaction((tx) => baixarEstoqueReceita(tx, receita.id, 5)),
    ])

    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const falha = resultados.find((r) => r.status === 'rejected') as PromiseRejectedResult
    expect(falha.reason).toBeInstanceOf(EstoqueInsuficienteError)
    expect(await estoqueDaReceita(receita.id)).toBe(3)
  })

  it('receita inexistente gera erro claro', async () => {
    await expect(prisma.$transaction((tx) => baixarEstoqueReceita(tx, 'nao-existe', 1)))
      .rejects.toThrow('Receita não encontrada')
  })

  it('repõe o estoque (cancelamentos e conclusão de ordens)', async () => {
    const receita = await criarReceita({ estoque: 2 })
    await prisma.$transaction((tx) => reporEstoqueReceita(tx, receita.id, 6))
    expect(await estoqueDaReceita(receita.id)).toBe(8)
  })
})

describe('estoque de insumos', () => {
  it('baixa com saldo e recusa saída maior que o saldo', async () => {
    const farinha = await criarInsumo({ nome: 'Farinha 00', estoque: 10 })
    await prisma.$transaction((tx) => baixarEstoqueInsumo(tx, farinha.id, 2.5))
    expect(await estoqueDoInsumo(farinha.id)).toBe(7.5)

    await expect(prisma.$transaction((tx) => baixarEstoqueInsumo(tx, farinha.id, 8)))
      .rejects.toThrow('Saldo insuficiente de Farinha 00. Estoque atual: 7,5')
  })

  it('insumo inexistente gera erro claro', async () => {
    await expect(prisma.$transaction((tx) => baixarEstoqueInsumo(tx, 'nao-existe', 1)))
      .rejects.toThrow('Insumo não encontrado')
  })

  it('"até o disponível" baixa só o que existe e devolve quanto baixou', async () => {
    const queijo = await criarInsumo({ estoque: 3 })
    const baixado = await prisma.$transaction((tx) => baixarEstoqueInsumoAteODisponivel(tx, queijo.id, 5))
    expect(decimal(baixado)).toBe(3)
    expect(await estoqueDoInsumo(queijo.id)).toBe(0)
  })

  it('"até o disponível" com estoque zerado não baixa nada', async () => {
    const vazio = await criarInsumo({ estoque: 0 })
    const baixado = await prisma.$transaction((tx) => baixarEstoqueInsumoAteODisponivel(tx, vazio.id, 2))
    expect(decimal(baixado)).toBe(0)
  })
})

describe('formatarQuantidade', () => {
  it('usa o formato brasileiro com até 3 casas', () => {
    expect(formatarQuantidade(1234.5)).toBe('1.234,5')
    expect(formatarQuantidade('0.1255')).toBe('0,126')
  })
})
