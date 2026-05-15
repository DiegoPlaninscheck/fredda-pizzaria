'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface InsumoOpcao {
  id: string
  nome: string
  unidade: string
  estoqueAtual: string
}

interface ItemReceita {
  insumoId: string
  quantidade: string
}

export default function NovaReceitaPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editarId = searchParams.get('editar')

  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [rendimento, setRendimento] = useState('')
  const [itens, setItens] = useState<ItemReceita[]>([{ insumoId: '', quantidade: '' }])
  const [insumos, setInsumos] = useState<InsumoOpcao[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    fetch('/api/insumos').then((r) => r.json()).then(setInsumos)

    if (editarId) {
      fetch(`/api/receitas/${editarId}`).then((r) => r.json()).then((data) => {
        setNome(data.nome)
        setDescricao(data.descricao || '')
        setRendimento(String(data.rendimento))
        setItens(data.insumos.map((i: { insumoId: string; quantidade: string }) => ({
          insumoId: i.insumoId,
          quantidade: String(i.quantidade),
        })))
      })
    }
  }, [editarId])

  function adicionarItem() {
    setItens([...itens, { insumoId: '', quantidade: '' }])
  }

  function removerItem(idx: number) {
    setItens(itens.filter((_, i) => i !== idx))
  }

  function atualizarItem(idx: number, campo: keyof ItemReceita, valor: string) {
    setItens(itens.map((item, i) => i === idx ? { ...item, [campo]: valor } : item))
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    const itensValidos = itens.filter((i) => i.insumoId && Number(i.quantidade) > 0)
    if (itensValidos.length === 0) { setErro('Adicione ao menos um ingrediente válido'); return }

    setSalvando(true)
    const url = editarId ? `/api/receitas/${editarId}` : '/api/receitas'
    const method = editarId ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, descricao, rendimento: Number(rendimento), insumos: itensValidos }),
    })

    setSalvando(false)
    if (res.ok) {
      router.push('/receitas')
    } else {
      const d = await res.json()
      setErro(d.error || 'Erro ao salvar')
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Receitas</button>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">{editarId ? 'Editar Receita' : 'Nova Receita'}</h1>
      </div>

      <form onSubmit={salvar} className="space-y-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Informações gerais</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da receita *</label>
            <input
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Pizza Margherita"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição opcional"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rendimento (unidades por lote) *</label>
            <input
              required
              type="number"
              min="0.001"
              step="0.001"
              value={rendimento}
              onChange={(e) => setRendimento(e.target.value)}
              placeholder="Ex: 8"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Ingredientes por unidade</h2>
            <button
              type="button"
              onClick={adicionarItem}
              className="text-sm text-orange-600 hover:text-orange-800 font-medium"
            >
              + Adicionar
            </button>
          </div>

          <div className="space-y-3">
            {itens.map((item, idx) => (
              <div key={idx} className="flex gap-3 items-center">
                <select
                  value={item.insumoId}
                  onChange={(e) => atualizarItem(idx, 'insumoId', e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Selecione o insumo</option>
                  {insumos.map((ins) => (
                    <option key={ins.id} value={ins.id}>{ins.nome} ({ins.unidade})</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={item.quantidade}
                  onChange={(e) => atualizarItem(idx, 'quantidade', e.target.value)}
                  placeholder="Qtd"
                  className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <span className="text-xs text-gray-500 w-10">
                  {insumos.find((i) => i.id === item.insumoId)?.unidade || ''}
                </span>
                {itens.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removerItem(idx)}
                    className="text-red-400 hover:text-red-600 text-sm font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {erro && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={salvando}
            className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
          >
            {salvando ? 'Salvando...' : 'Salvar Receita'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
