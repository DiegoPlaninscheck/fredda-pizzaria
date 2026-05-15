'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Categoria { id: string; nome: string }
interface Fornecedor { id: string; nome: string }

const UNIDADES = ['KG', 'GRAMA', 'LITRO', 'ML', 'UNIDADE', 'PACOTE', 'SACO', 'CAIXA'] as const

export default function NovoInsumoPage() {
  const router = useRouter()
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [form, setForm] = useState({
    nome: '',
    unidade: 'KG',
    estoqueMinimo: '',
    precoUnitario: '',
    categoriaId: '',
    fornecedorId: '',
  })

  useEffect(() => {
    fetch('/api/categorias').then((r) => r.json()).then(setCategorias)
    fetch('/api/fornecedores').then((r) => r.json()).then(setFornecedores)
  }, [])

  function set(campo: string, valor: string) {
    setForm((prev) => ({ ...prev, [campo]: valor }))
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome.trim() || !form.categoriaId) {
      setErro('Nome e categoria são obrigatórios')
      return
    }
    setSalvando(true)
    setErro('')

    const res = await fetch('/api/insumos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    if (res.ok) {
      router.push('/estoque')
    } else {
      const data = await res.json()
      setErro(data.error || 'Erro ao salvar')
      setSalvando(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href="/estoque" className="text-sm text-gray-500 hover:text-gray-700">
          ← Estoque
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Novo Insumo</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <form onSubmit={salvar} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => set('nome', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Ex: Farinha de Trigo Tipo 1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unidade de medida *</label>
              <select
                value={form.unidade}
                onChange={(e) => set('unidade', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estoque mínimo</label>
              <input
                type="number"
                min="0"
                step="0.001"
                value={form.estoqueMinimo}
                onChange={(e) => set('estoqueMinimo', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria *</label>
              <select
                value={form.categoriaId}
                onChange={(e) => set('categoriaId', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Selecione...</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fornecedor padrão</label>
              <select
                value={form.fornecedorId}
                onChange={(e) => set('fornecedorId', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Nenhum</option>
                {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Preço unitário (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.precoUnitario}
              onChange={(e) => set('precoUnitario', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="0,00"
            />
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={salvando}
              className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
            >
              {salvando ? 'Salvando...' : 'Salvar Insumo'}
            </button>
            <Link
              href="/estoque"
              className="text-sm text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
