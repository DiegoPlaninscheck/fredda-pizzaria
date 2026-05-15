'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Categoria {
  id: string
  nome: string
}

interface Insumo {
  id: string
  nome: string
  unidade: string
  estoqueAtual: string
  estoqueMinimo: string
  estoqueAbaixoMinimo: boolean
  ativo: boolean
  categoria: { nome: string }
  fornecedor: { nome: string } | null
}

export default function EstoquePage() {
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [categoriaId, setCategoriaId] = useState('')
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [apenasAlerta, setApenasAlerta] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (categoriaId) params.set('categoriaId', categoriaId)
    if (mostrarInativos) params.set('ativo', 'false')
    if (apenasAlerta) params.set('alerta', 'true')

    const res = await fetch(`/api/insumos?${params}`)
    if (res.ok) setInsumos(await res.json())
    setLoading(false)
  }, [categoriaId, mostrarInativos, apenasAlerta])

  useEffect(() => {
    fetch('/api/categorias').then((r) => r.json()).then(setCategorias)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function inativar(insumo: Insumo) {
    if (!confirm(`Inativar "${insumo.nome}"?`)) return
    await fetch(`/api/insumos/${insumo.id}`, { method: 'DELETE' })
    carregar()
  }

  const alertas = insumos.filter((i) => i.estoqueAbaixoMinimo).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estoque de Insumos</h1>
          <p className="text-sm text-gray-500 mt-1">
            {alertas > 0 && (
              <span className="text-red-600 font-medium">{alertas} insumo(s) abaixo do mínimo · </span>
            )}
            Controle de entradas, saídas e rastreabilidade
          </p>
        </div>
        <Link
          href="/estoque/novo"
          className="bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Novo Insumo
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={categoriaId}
          onChange={(e) => setCategoriaId(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="">Todas as categorias</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={apenasAlerta}
            onChange={(e) => setApenasAlerta(e.target.checked)}
            className="rounded"
          />
          Apenas alertas
        </label>

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
      ) : insumos.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">Nenhum insumo encontrado</p>
          <p className="text-sm mt-1">Clique em &quot;Novo Insumo&quot; para cadastrar</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Insumo</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Categoria</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Estoque Atual</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Mínimo</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {insumos.map((insumo) => (
                <tr
                  key={insumo.id}
                  className={`hover:bg-gray-50 transition-colors ${!insumo.ativo ? 'opacity-60' : ''}`}
                >
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{insumo.nome}</div>
                    {insumo.fornecedor && (
                      <div className="text-xs text-gray-400">{insumo.fornecedor.nome}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{insumo.categoria.nome}</td>
                  <td className="px-6 py-4 text-sm text-right">
                    <span className={insumo.estoqueAbaixoMinimo ? 'text-red-600 font-semibold' : 'text-gray-900'}>
                      {Number(insumo.estoqueAtual).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {insumo.unidade}
                    </span>
                    {insumo.estoqueAbaixoMinimo && (
                      <span className="ml-2 inline-flex px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-600 font-medium">
                        ALERTA
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-500">
                    {Number(insumo.estoqueMinimo).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {insumo.unidade}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${insumo.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {insumo.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-3">
                    <Link
                      href={`/estoque/${insumo.id}`}
                      className="text-sm text-orange-600 hover:text-orange-800 font-medium"
                    >
                      Detalhes
                    </Link>
                    {insumo.ativo && (
                      <button
                        onClick={() => inativar(insumo)}
                        className="text-sm text-red-500 hover:text-red-700 font-medium"
                      >
                        Inativar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
