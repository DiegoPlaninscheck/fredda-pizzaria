import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  const [totalInsumos, fornecedoresAtivos, insumos] = await Promise.all([
    prisma.insumo.count({ where: { ativo: true } }),
    prisma.fornecedor.count({ where: { ativo: true } }),
    prisma.insumo.findMany({
      where: { ativo: true },
      select: { estoqueAtual: true, estoqueMinimo: true, nome: true, unidade: true, id: true },
    }),
  ])

  const alertas = insumos.filter((i) => i.estoqueAtual < i.estoqueMinimo)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h1>
      <p className="text-gray-500 mb-8">Bem-vindo, {session?.user?.name}.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link href="/estoque" className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:border-orange-200 hover:shadow-md transition-all">
          <p className="text-sm text-gray-500">Insumos em estoque</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{totalInsumos}</p>
          <p className="text-xs text-orange-600 mt-2">Ver estoque →</p>
        </Link>

        <Link href="/estoque?alerta=true" className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:border-red-200 hover:shadow-md transition-all">
          <p className="text-sm text-gray-500">Alertas de estoque mínimo</p>
          <p className={`text-3xl font-bold mt-1 ${alertas.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {alertas.length}
          </p>
          {alertas.length > 0 && (
            <p className="text-xs text-red-600 mt-2">Ver alertas →</p>
          )}
          {alertas.length === 0 && (
            <p className="text-xs text-green-600 mt-2">Tudo em ordem</p>
          )}
        </Link>

        <Link href="/fornecedores" className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:border-orange-200 hover:shadow-md transition-all">
          <p className="text-sm text-gray-500">Fornecedores ativos</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{fornecedoresAtivos}</p>
          <p className="text-xs text-orange-600 mt-2">Ver fornecedores →</p>
        </Link>
      </div>

      {alertas.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-red-700 mb-3">
            Insumos abaixo do estoque mínimo ({alertas.length})
          </h2>
          <ul className="space-y-2">
            {alertas.map((insumo) => (
              <li key={insumo.id} className="flex items-center justify-between text-sm">
                <Link href={`/estoque/${insumo.id}`} className="text-red-700 hover:underline font-medium">
                  {insumo.nome}
                </Link>
                <span className="text-red-600">
                  {Number(insumo.estoqueAtual).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} /
                  mín {Number(insumo.estoqueMinimo).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {insumo.unidade}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
