'use client'

import { useState, useEffect, useCallback } from 'react'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import Link from 'next/link'

interface Fornecedor {
  id: string
  nome: string
  cnpj: string | null
  telefone: string | null
  email: string | null
  ativo: boolean
  _count: { insumos: number }
}

export default function FornecedoresPage() {
  const confirmar = useConfirm()
  const toast = useToast()
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [mostrarInativos, setMostrarInativos] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (busca) params.set('busca', busca)
    if (mostrarInativos) params.set('ativo', 'false')
    const res = await fetch(`/api/fornecedores?${params}`)
    if (res.ok) setFornecedores(await res.json())
    setLoading(false)
  }, [busca, mostrarInativos])

  useEffect(() => { carregar() }, [carregar])

  async function toggleAtivo(f: Fornecedor) {
    const acao = f.ativo ? 'Inativar' : 'Reativar'
    const ok = await confirmar({ titulo: `${acao} o fornecedor "${f.nome}"?`, confirmar: acao, perigo: f.ativo })
    if (!ok) return
    const res = await fetch(`/api/fornecedores/${f.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, ativo: !f.ativo }),
    })
    if (res.ok) toast.sucesso(`Fornecedor "${f.nome}" ${f.ativo ? 'inativado' : 'reativado'}`)
    else toast.erro('Não foi possível atualizar o fornecedor', (await res.json().catch(() => ({}))).error)
    carregar()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900">Fornecedores</h1>
          <p className="text-sm text-gray-500 mt-1">Cadastro de fornecedores de insumos</p>
        </div>
        <Link
          href="/fornecedores/novo"
          className="bg-brand-900 hover:bg-brand-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Novo Fornecedor
        </Link>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar por nome..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 max-w-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={mostrarInativos}
            onChange={(e) => setMostrarInativos(e.target.checked)}
            className="rounded"
          />
          Mostrar inativos
        </label>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Carregando...</p>
      ) : fornecedores.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">Nenhum fornecedor encontrado</p>
          <p className="text-sm mt-1">Clique em &quot;Novo Fornecedor&quot; para cadastrar</p>
        </div>
      ) : (
        <div className="bg-white border border-[#e7e1cf] rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">CNPJ</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contato</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Insumos</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fornecedores.map((f) => (
                <tr key={f.id} className={`hover:bg-gray-50 transition-colors ${!f.ativo ? 'opacity-60' : ''}`}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{f.nome}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{f.cnpj || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{f.telefone || f.email || '—'}</td>
                  <td className="px-6 py-4 text-sm text-center text-gray-700">{f._count.insumos}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${f.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {f.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-3">
                    <Link
                      href={`/fornecedores/${f.id}/editar`}
                      className="text-sm text-brand-600 hover:text-brand-800 font-medium"
                    >
                      Editar
                    </Link>
                    <button
                      onClick={() => toggleAtivo(f)}
                      className={`text-sm font-medium ${f.ativo ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800'}`}
                    >
                      {f.ativo ? 'Inativar' : 'Reativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}
