'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface ReceitaOpcao {
  id: string
  nome: string
  descricao: string | null
  rendimento: string
  insumos: {
    id: string
    quantidade: string
    insumo: { id: string; nome: string; unidade: string; estoqueAtual: string }
  }[]
}

interface InsumoInsuficiente {
  nome: string
  necessario: string
  disponivel: string
  unidade: string
}

export default function NovaOrdemPage() {
  const router = useRouter()
  const [receitas, setReceitas] = useState<ReceitaOpcao[]>([])
  const [receitaId, setReceitaId] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [dataPrevista, setDataPrevista] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [insuficientes, setInsuficientes] = useState<InsumoInsuficiente[]>([])

  useEffect(() => {
    fetch('/api/receitas').then((r) => r.json()).then(setReceitas)
  }, [])

  const receitaSelecionada = receitas.find((r) => r.id === receitaId)

  function necessidadeInsumo(insumo: ReceitaOpcao['insumos'][0]) {
    const qtd = Number(quantidade) || 0
    return qtd > 0 ? Number(insumo.quantidade) * qtd : 0
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setInsuficientes([])

    if (!receitaId) { setErro('Selecione uma receita'); return }
    if (Number(quantidade) <= 0) { setErro('Informe a quantidade'); return }

    setSalvando(true)
    const res = await fetch('/api/ordens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receitaId,
        quantidade: Number(quantidade),
        dataPrevista: dataPrevista || null,
        observacoes: observacoes.trim() || null,
      }),
    })

    setSalvando(false)

    if (res.ok) {
      const ordem = await res.json()
      router.push(`/producao/${ordem.id}`)
    } else if (res.status === 422) {
      const d = await res.json()
      setInsuficientes(d.insuficientes || [])
      setErro(d.error || 'Estoque insuficiente')
    } else {
      const d = await res.json()
      setErro(d.error || 'Erro ao criar ordem')
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Produção</button>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Nova Ordem de Produção</h1>
      </div>

      <form onSubmit={salvar} className="space-y-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Configuração</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Receita *</label>
            <select
              required
              value={receitaId}
              onChange={(e) => { setReceitaId(e.target.value); setInsuficientes([]) }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Selecione a receita</option>
              {receitas.map((r) => (
                <option key={r.id} value={r.id}>{r.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade (unidades a produzir) *</label>
            <input
              required
              type="number"
              min="1"
              step="1"
              value={quantidade}
              onChange={(e) => { setQuantidade(e.target.value); setInsuficientes([]) }}
              placeholder="Ex: 20"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data prevista</label>
            <input
              type="date"
              value={dataPrevista}
              onChange={(e) => setDataPrevista(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações opcionais"
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            />
          </div>
        </div>

        {receitaSelecionada && Number(quantidade) > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
              Insumos necessários
            </h2>
            <div className="space-y-2">
              {receitaSelecionada.insumos.map((ri) => {
                const necessario = necessidadeInsumo(ri)
                const disponivel = Number(ri.insumo.estoqueAtual)
                const suficiente = disponivel >= necessario
                return (
                  <div
                    key={ri.id}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                      suficiente ? 'bg-green-50' : 'bg-red-50'
                    }`}
                  >
                    <span className="text-sm text-gray-700">{ri.insumo.nome}</span>
                    <div className="text-right">
                      <span className={`text-sm font-medium ${suficiente ? 'text-green-700' : 'text-red-700'}`}>
                        {necessario.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {ri.insumo.unidade}
                      </span>
                      <span className="text-xs text-gray-500 ml-2">
                        (est. {disponivel.toLocaleString('pt-BR', { maximumFractionDigits: 3 })})
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {insuficientes.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-red-700 mb-2">Estoque insuficiente:</p>
            <div className="space-y-1">
              {insuficientes.map((ins, i) => (
                <p key={i} className="text-sm text-red-600">
                  {ins.nome}: necessário {Number(ins.necessario).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {ins.unidade},
                  disponível {Number(ins.disponivel).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {ins.unidade}
                </p>
              ))}
            </div>
          </div>
        )}

        {erro && insuficientes.length === 0 && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={salvando}
            className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
          >
            {salvando ? 'Criando...' : 'Criar Ordem'}
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
