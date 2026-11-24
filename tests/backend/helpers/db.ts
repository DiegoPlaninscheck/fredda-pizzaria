import { Prisma, Role, UnidadeMedida } from '@prisma/client'
import { prisma } from '@/lib/prisma'

let tabelas: string[] | null = null

/** Apaga os dados de todas as tabelas (o schema continua). Roda antes de cada teste. */
export async function limparBanco() {
  if (!tabelas) {
    const linhas = await prisma.$queryRaw<{ nome: string }[]>`
      SELECT TABLE_NAME AS nome FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME <> '_prisma_migrations'`
    tabelas = linhas.map((l) => l.nome)
  }
  // Mesma conexão para todas as instruções: o SET vale só para a sessão
  await prisma.$transaction([
    prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0'),
    ...tabelas.map((t) => prisma.$executeRawUnsafe(`DELETE FROM \`${t}\``)),
    prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1'),
  ])
}

let seq = 0
const unico = (prefixo: string) => `${prefixo}-${Date.now().toString(36)}-${++seq}`

export function criarUsuario(role: Role = 'OPERADOR', id?: string) {
  return prisma.user.create({
    data: { id, nome: `Usuário ${role}`, email: `${unico(role.toLowerCase())}@teste.com`, senha: 'hash', role },
  })
}

export function criarCategoria(nome = unico('Categoria')) {
  return prisma.categoria.create({ data: { nome } })
}

export async function criarInsumo(opcoes: {
  nome?: string
  estoque?: number
  minimo?: number
  unidade?: UnidadeMedida
  categoriaId?: string
  ativo?: boolean
} = {}) {
  const categoriaId = opcoes.categoriaId ?? (await criarCategoria()).id
  return prisma.insumo.create({
    data: {
      nome: opcoes.nome ?? unico('Insumo'),
      unidade: opcoes.unidade ?? 'KG',
      estoqueAtual: opcoes.estoque ?? 0,
      estoqueMinimo: opcoes.minimo ?? 0,
      ativo: opcoes.ativo ?? true,
      categoriaId,
    },
  })
}

/** Receita (sabor). `ingredientes` = quantidade de cada insumo por unidade de rendimento. */
export async function criarReceita(opcoes: {
  nome?: string
  estoque?: number
  preco?: number | null
  rendimento?: number
  ativo?: boolean
  ingredientes?: { insumoId: string; quantidade: number }[]
} = {}) {
  return prisma.receita.create({
    data: {
      nome: opcoes.nome ?? unico('Sabor'),
      rendimento: opcoes.rendimento ?? 1,
      estoqueAtual: opcoes.estoque ?? 0,
      precoVenda: opcoes.preco === undefined ? 45 : opcoes.preco,
      ativo: opcoes.ativo ?? true,
      insumos: opcoes.ingredientes ? { create: opcoes.ingredientes } : undefined,
    },
  })
}

export function criarCliente(opcoes: { telefone?: string; nome?: string | null; endereco?: string | null } = {}) {
  return prisma.cliente.create({
    data: {
      telefone: opcoes.telefone ?? `55479${Math.floor(10000000 + Math.random() * 89999999)}`,
      nome: opcoes.nome === undefined ? 'Cliente Teste' : opcoes.nome,
      endereco: opcoes.endereco ?? null,
    },
  })
}

export function criarConversa(clienteId: string, dados: Partial<Prisma.ConversaUncheckedCreateInput> = {}) {
  return prisma.conversa.create({ data: { clienteId, historico: [], ...dados } })
}

export const decimal = (v: Prisma.Decimal | number | string | null | undefined) => Number(v ?? 0)
