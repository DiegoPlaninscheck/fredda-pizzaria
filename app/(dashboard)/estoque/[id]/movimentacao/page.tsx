'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface Fornecedor { id: string; nome: string }

export default function MovimentacaoPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [nomeInsumo, setNomeInsumo] = useState('')
  const [form, setForm] = useState({
    tipo: 'ENTRADA',
    quantidade: '',
    lote: '',
    dataVencimento: '',
    precoUnitario: '',
    fornecedorId: '',
    motivo: '',
  })

  useEffect(() => {
    fetch(`/api/insumos/${id}`).then((r) => r.json()).then((d) => setNomeInsumo(d.nome || ''))
    fetch('/api/fornecedores').then((r) => r.json()).then(setFornecedores)
  }, [id])

  function set(campo: string, valor: string) {
    setForm((prev) => ({ ...prev, [campo]: valor }))
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.quantidade || Number(form.quantidade) <= 0) {
      setErro('Quantidade deve ser maior que zero')
      return
    }
    setSalvando(true)
    setErro('')

    const res = await fetch(`/api/insumos/${id}/movimentacoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    if (res.ok) {
      router.push(`/estoque/${id}`)
    } else {
      const data = await res.json()
      setErro(data.error || 'Erro ao registrar movimentação')
      setSalvando(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href={`/estoque/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← {nomeInsumo || 'Insumo'}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Registrar Movimentação</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <form onSubmit={salvar} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de movimentação *</label>
            <div className="flex gap-4">
              {(['ENTRADA', 'SAIDA'] as const).map((tipo) => (
                <label key={tipo} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value={tipo}
                    checked={form.tipo === tipo}
                    onChange={() => set('tipo', tipo)}
                    className="accent-orange-600"
                  />
                  <span className={`text-sm font-medium ${tipo === 'ENTRADA' ? 'text-green-700' : 'text-red-700'}`}>
                    {tipo === 'ENTRADA' ? '+ Entrada' : '− Saída'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade *</label>
            <input
              type="number"
              min="0.001"
              step="0.001"
              value={form.quantidade}
              onChange={(e) => set('quantidade', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="0,000"
            />
          </div>

          {form.tipo === 'ENTRADA' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número do lote
                    <span className="text-gray-400 font-normal ml-1">(gerado automaticamente)</span>
                  </label>
                  <input
                    type="text"
                    value={form.lote}
                    onChange={(e) => set('lote', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Ex: LOTE-20260513-A1B2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data de vencimento</label>
                  <input
                    type="date"
                    value={form.dataVencimento}
                    onChange={(e) => set('dataVencimento', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fornecedor</label>
                  <select
                    value={form.fornecedorId}
                    onChange={(e) => set('fornecedorId', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Nenhum</option>
                    {fornecedores.map((f) => (
                      <option key={f.id} value={f.id}>{f.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Custo unitário (R$)</label>
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
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {form.tipo === 'SAIDA' ? 'Motivo da saída' : 'Observação'}
            </label>
            <input
              type="text"
              value={form.motivo}
              onChange={(e) => set('motivo', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder={form.tipo === 'SAIDA' ? 'Ex: Uso na produção do dia 13/05' : 'Observação opcional'}
            />
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={salvando}
              className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
            >
              {salvando ? 'Salvando...' : `Registrar ${form.tipo === 'ENTRADA' ? 'Entrada' : 'Saída'}`}
            </button>
            <Link
              href={`/estoque/${id}`}
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
