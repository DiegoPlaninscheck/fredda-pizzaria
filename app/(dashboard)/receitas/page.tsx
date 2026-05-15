'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface ReceitaInsumo {
  id: string
  quantidade: string
  insumo: { id: string; nome: string; unidade: string }
}

interface Receita {
  id: string
  nome: string
  descricao: string | null
  rendimento: string
  ativo: boolean
  insumos: ReceitaInsumo[]
  _count: { ordens: number }
}

export default function ReceitasPage() {
  const [receitas, setReceitas] = useState<Receita[]>([])
  const [loading, setLoading] = useState(true)
  const [expandida, setExpandida] = useState<string | null>(null)

  async function carregar() {
    setLoading(true)
    const res = await fetch('/api/receitas')
    if (res.ok) setReceitas(await res.json())
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  async function inativar(id: string) {
    if (!confirm('Inativar esta receita?')) return
    const res = await fetch(`/api/receitas/${id}`, { method: 'DELETE' })
    if (res.ok) carregar()
    else {
      const d = await res.json()
      alert(d.error || 'Erro ao inativar')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Receitas</h1>
          <p className="text-sm text-gray-500 mt-1">Fichas técnicas das pizzas</p>
        </div>
        <Link
          href="/receitas/nova"
          className="bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Nova Receita
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Carregando...</p>
      ) : receitas.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">Nenhuma receita cadastrada</p>
          <p className="text-sm mt-1">Crie a ficha técnica das suas pizzas para começar a produzir</p>
        </div>
      ) : (
        <div className="space-y-3">
          {receitas.map((r) => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-xl shadow-sm">
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer"
                onClick={() => setExpandida(expandida === r.id ? null : r.id)}
              >
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-semibold text-gray-900">{r.nome}</p>
                    {r.descricao && <p className="text-sm text-gray-500 mt-0.5">{r.descricao}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Rendimento</p>
                    <p className="text-sm font-semibold text-gray-900">{Number(r.rendimento)} un.</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Insumos</p>
                    <p className="text-sm font-semibold text-gray-900">{r.insumos.length}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Ordens</p>
                    <p className="text-sm font-semibold text-gray-900">{r._count.ordens}</p>
                  </div>
                  <div className="flex gap-3">
                    <Link
                      href={`/receitas/nova?editar=${r.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-sm text-orange-600 hover:text-orange-800 font-medium"
                    >
                      Editar
                    </Link>
                    <button
                      onClick={(e) => { e.stopPropagation(); inativar(r.id) }}
                      className="text-sm text-red-500 hover:text-red-700 font-medium"
                    >
                      Inativar
                    </button>
                  </div>
                  <span className="text-gray-400 text-xs">{expandida === r.id ? '▲' : '▼'}</span>
                </div>
              </div>

              {expandida === r.id && (
                <div className="border-t border-gray-100 px-5 py-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Ingredientes por unidade produzida
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {r.insumos.map((ri) => (
                      <div key={ri.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-sm text-gray-700">{ri.insumo.nome}</span>
                        <span className="text-sm font-medium text-gray-900">
                          {Number(ri.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {ri.insumo.unidade}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
