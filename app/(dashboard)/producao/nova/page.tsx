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
  receita: string
  nome: string
  necessario: string
  disponivel: string
}

export default function NovaOrdemPage() {
  const router = useRouter()
  const [receitas, setReceitas] = useState<ReceitaOpcao[]>([])
  const [quantidades, setQuantidades] = useState<Record<string, string>>({})
  const [dataPrevista, setDataPrevista] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [insuficientes, setInsuficientes] = useState<InsumoInsuficiente[]>([])
  const [ordemCriadaId, setOrdemCriadaId] = useState('')

  useEffect(() => {
    fetch('/api/receitas').then((r) => r.json()).then(setReceitas)
  }, [])

  const receitasSelecionadas = receitas.filter((r) => r.id in quantidades)

  function alternarReceita(receitaId: string, marcada: boolean) {
    setInsuficientes([])
    setQuantidades((prev) => {
      const novo = { ...prev }
      if (marcada) novo[receitaId] = novo[receitaId] ?? ''
      else delete novo[receitaId]
      return novo
    })
  }

  function alterarQuantidade(receitaId: string, valor: string) {
    setInsuficientes([])
    setQuantidades((prev) => ({ ...prev, [receitaId]: valor }))
  }

  function necessidadeInsumo(insumo: ReceitaOpcao['insumos'][0], receitaId: string) {
    const qtd = Number(quantidades[receitaId]) || 0
    return qtd > 0 ? Number(insumo.quantidade) * qtd : 0
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setInsuficientes([])

    if (receitasSelecionadas.length === 0) { setErro('Selecione ao menos uma receita'); return }

    const payloadReceitas: { receitaId: string; quantidade: number }[] = []
    for (const r of receitasSelecionadas) {
      const qtd = Number(quantidades[r.id])
      if (!qtd || qtd <= 0) {
        setErro(`Informe a quantidade para "${r.nome}"`)
        return
      }
      payloadReceitas.push({ receitaId: r.id, quantidade: qtd })
    }

    setSalvando(true)
    const res = await fetch('/api/ordens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receitas: payloadReceitas,
        dataPrevista: dataPrevista || null,
        observacoes: observacoes.trim() || null,
      }),
    })

    setSalvando(false)

    if (res.ok) {
      const ordem = await res.json()
      if (ordem.insuficientes?.length > 0) {
        setInsuficientes(ordem.insuficientes)
        setOrdemCriadaId(ordem.id)
      } else {
        router.push(`/producao/${ordem.id}`)
      }
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
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Receitas</h2>

          <div className="space-y-3">
            {receitas.map((r) => {
              const marcada = r.id in quantidades
              return (
                <div
                  key={r.id}
                  className={`border rounded-lg px-3 py-2.5 transition-colors ${
                    marcada ? 'border-brand-300 bg-brand-50' : 'border-gray-200'
                  }`}
                >
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={marcada}
                      onChange={(e) => alternarReceita(r.id, e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-sm font-medium text-gray-800">{r.nome}</span>
                  </label>

                  {marcada && (
                    <div className="mt-2 ml-6">
                      <label className="block text-xs text-gray-500 mb-1">Quantidade (unidades a produzir)</label>
                      <input
                        required
                        type="number"
                        min="1"
                        step="1"
                        value={quantidades[r.id]}
                        onChange={(e) => alterarQuantidade(r.id, e.target.value)}
                        placeholder="Ex: 20"
                        className="w-full sm:w-40 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  )}
                </div>
              )
            })}
            {receitas.length === 0 && (
              <p className="text-sm text-gray-400">Nenhuma receita cadastrada.</p>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Configuração</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data prevista</label>
            <input
              type="date"
              value={dataPrevista}
              onChange={(e) => setDataPrevista(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações opcionais"
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>
        </div>

        {receitasSelecionadas.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Insumos necessários
            </h2>
            {receitasSelecionadas.map((r) => (
              <div key={r.id}>
                <p className="text-xs font-semibold text-gray-500 mb-2">{r.nome}</p>
                <div className="space-y-2">
                  {r.insumos.map((ri) => {
                    const necessario = necessidadeInsumo(ri, r.id)
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
            ))}
            <p className="text-xs text-gray-400">
              Insumos com estoque insuficiente não impedem a criação da ordem — sirvem apenas de aviso.
            </p>
          </div>
        )}

        {insuficientes.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-yellow-700 mb-2">
              Ordem criada, mas há estoque insuficiente para alguns insumos:
            </p>
            <div className="space-y-1 mb-3">
              {insuficientes.map((ins, i) => (
                <p key={i} className="text-sm text-yellow-700">
                  [{ins.receita}] {ins.nome}: necessário {Number(ins.necessario).toLocaleString('pt-BR', { maximumFractionDigits: 3 })},
                  disponível {Number(ins.disponivel).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                </p>
              ))}
            </div>
            <button
              type="button"
              onClick={() => router.push(`/producao/${ordemCriadaId}`)}
              className="text-sm font-medium text-brand-700 hover:text-brand-900 underline"
            >
              Ver ordem criada →
            </button>
          </div>
        )}

        {erro && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={salvando}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
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
