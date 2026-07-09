'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Receita {
  id: string
  nome: string
  estoqueAtual: string
}

const FORMAS_PAGAMENTO = ['PIX NA CONTA', 'PIX NA MÁQUINA', 'DINHEIRO', 'DÉBITO', 'CRÉDITO', 'PERMUTA']

export default function NovaVendaPage() {
  const router = useRouter()
  const [receitas, setReceitas] = useState<Receita[]>([])
  const [receitaId, setReceitaId] = useState('')
  const [cliente, setCliente] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [precoUnitario, setPrecoUnitario] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('')
  const [pago, setPago] = useState(true)
  const [entregue, setEntregue] = useState(true)
  const [dataVenda, setDataVenda] = useState('')
  const [dataEntrega, setDataEntrega] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    fetch('/api/receitas').then((r) => r.json()).then(setReceitas)
  }, [])

  const receitaSelecionada = receitas.find((r) => r.id === receitaId)
  const valorTotal = (Number(quantidade) || 0) * (Number(precoUnitario) || 0)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    if (!receitaId) { setErro('Selecione uma receita'); return }
    if (!cliente.trim()) { setErro('Informe o cliente'); return }
    if (Number(quantidade) <= 0) { setErro('Informe a quantidade'); return }
    if (Number(precoUnitario) <= 0) { setErro('Informe o preço unitário'); return }

    setSalvando(true)
    const res = await fetch('/api/vendas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receitaId,
        cliente: cliente.trim(),
        quantidade: Number(quantidade),
        precoUnitario: Number(precoUnitario),
        formaPagamento: formaPagamento || null,
        pago,
        entregue,
        dataVenda: dataVenda || null,
        dataEntrega: dataEntrega || null,
        observacoes: observacoes.trim() || null,
      }),
    })

    setSalvando(false)

    if (res.ok) {
      router.push('/vendas')
    } else {
      const d = await res.json()
      setErro(d.error || 'Erro ao registrar venda')
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Vendas</button>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Registrar Venda</h1>
      </div>

      <form onSubmit={salvar} className="space-y-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
            <input
              required
              type="text"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Nome do cliente"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Receita *</label>
            <select
              required
              value={receitaId}
              onChange={(e) => setReceitaId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Selecione a receita</option>
              {receitas.map((r) => (
                <option key={r.id} value={r.id}>{r.nome}</option>
              ))}
            </select>
            {receitaSelecionada && (
              <p className="text-xs text-gray-400 mt-1">
                Estoque disponível: {Number(receitaSelecionada.estoqueAtual).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} unidade(s)
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade *</label>
              <input
                required
                type="number"
                min="1"
                step="1"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                placeholder="Ex: 1"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preço unitário (R$) *</label>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={precoUnitario}
                onChange={(e) => setPrecoUnitario(e.target.value)}
                placeholder="Ex: 45.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Forma de pagamento</label>
            <select
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Não informado</option>
              {FORMAS_PAGAMENTO.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={pago} onChange={(e) => setPago(e.target.checked)} className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
              Pago
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={entregue} onChange={(e) => setEntregue(e.target.checked)} className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
              Entregue
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data da venda</label>
              <input
                type="datetime-local"
                value={dataVenda}
                onChange={(e) => setDataVenda(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="text-xs text-gray-400 mt-1">Vazio = agora</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data de entrega</label>
              <input
                type="date"
                value={dataEntrega}
                onChange={(e) => setDataEntrega(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
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

          {valorTotal > 0 && (
            <div className="bg-brand-50 border border-brand-200 rounded-lg px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-medium text-brand-700">Valor total</span>
              <span className="text-lg font-bold text-brand-700">
                R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>

        {erro && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={salvando}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
          >
            {salvando ? 'Salvando...' : 'Registrar Venda'}
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
