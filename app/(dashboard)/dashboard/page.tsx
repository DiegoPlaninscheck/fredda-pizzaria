import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h1>
      <p className="text-gray-500">Bem-vindo, {session?.user?.name}.</p>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <p className="text-sm text-gray-500">Insumos em estoque</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">—</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <p className="text-sm text-gray-500">Alertas de estoque mínimo</p>
          <p className="text-3xl font-bold text-red-600 mt-1">—</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <p className="text-sm text-gray-500">Fornecedores ativos</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">—</p>
        </div>
      </div>
    </div>
  )
}
