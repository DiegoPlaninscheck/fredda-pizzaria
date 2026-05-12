import { PrismaClient, Role, UnidadeMedida } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Iniciando seed...')

  // Admin
  const senhaHash = await bcrypt.hash('admin123', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@freddapizzaria.com' },
    update: {},
    create: {
      nome: 'Administrador',
      email: 'admin@freddapizzaria.com',
      senha: senhaHash,
      role: Role.ADMIN,
    },
  })
  console.log(`Usuário criado: ${admin.email}`)

  // Categorias
  const categorias = await Promise.all([
    prisma.categoria.upsert({
      where: { nome: 'Farinhas e grãos' },
      update: {},
      create: { nome: 'Farinhas e grãos', descricao: 'Farinhas, semolinas e cereais' },
    }),
    prisma.categoria.upsert({
      where: { nome: 'Laticínios' },
      update: {},
      create: { nome: 'Laticínios', descricao: 'Queijos, manteiga, iogurte' },
    }),
    prisma.categoria.upsert({
      where: { nome: 'Embutidos e proteínas' },
      update: {},
      create: { nome: 'Embutidos e proteínas', descricao: 'Calabresa, pepperoni, frango' },
    }),
    prisma.categoria.upsert({
      where: { nome: 'Molhos e condimentos' },
      update: {},
      create: { nome: 'Molhos e condimentos', descricao: 'Tomate, azeite, temperos' },
    }),
    prisma.categoria.upsert({
      where: { nome: 'Embalagens' },
      update: {},
      create: { nome: 'Embalagens', descricao: 'Caixas, papéis e embalagens' },
    }),
  ])
  console.log(`${categorias.length} categorias criadas.`)

  // Fornecedor exemplo
  const fornecedor = await prisma.fornecedor.upsert({
    where: { cnpj: '00.000.000/0001-00' },
    update: {},
    create: {
      nome: 'Fornecedor Exemplo',
      cnpj: '00.000.000/0001-00',
      telefone: '(48) 99999-0000',
      email: 'contato@fornecedor.com',
    },
  })
  console.log(`Fornecedor criado: ${fornecedor.nome}`)

  // Insumos base
  const farinhaCat = categorias[0]
  const insumos = await Promise.all([
    prisma.insumo.create({
      data: {
        nome: 'Farinha de trigo tipo 1',
        unidade: UnidadeMedida.KG,
        estoqueAtual: 50,
        estoqueMinimo: 20,
        precoUnitario: 4.5,
        categoriaId: farinhaCat.id,
        fornecedorId: fornecedor.id,
      },
    }),
    prisma.insumo.create({
      data: {
        nome: 'Fermento biológico seco',
        unidade: UnidadeMedida.GRAMA,
        estoqueAtual: 500,
        estoqueMinimo: 200,
        precoUnitario: 0.08,
        categoriaId: farinhaCat.id,
      },
    }),
    prisma.insumo.create({
      data: {
        nome: 'Sal refinado',
        unidade: UnidadeMedida.KG,
        estoqueAtual: 10,
        estoqueMinimo: 5,
        precoUnitario: 2.0,
        categoriaId: farinhaCat.id,
      },
    }),
  ])
  console.log(`${insumos.length} insumos criados.`)

  console.log('Seed concluído.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
