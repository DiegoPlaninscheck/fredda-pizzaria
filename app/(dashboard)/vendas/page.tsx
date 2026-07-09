'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Receita {
  id: string
  nome: string
}

interface Venda {
  id: string
  cliente: string
  quantidade: string
  precoUnitario: string
  valorTotal: string
  formaPagamento: string | null
  pago: boolean
  entregue: boolean
  dataVenda: string
  observacoes: string | null
  receita: { id: string; nome: string }
  usuario: { nome: string }
}

export default function VendasPage() {
  const [vendas, setVendas] = useState<Venda[]>([])
  const [receitas, setReceitas] = useState<Receita[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroReceita, setFiltroReceita] = useState('')
  const [filtroInicio, setFiltroInicio] = useState('')
  const [filtroFim, setFiltroFim] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filtroReceita) params.set('receitaId', filtroReceita)
    if (filtroInicio) params.set('dataInicio', filtroInicio)
    if (filtroFim) params.set('dataFim', filtroFim)
    const res = await fetch(`/api/vendas?${params}`)
    if (res.ok) setVendas(await res.json())
    setLoading(false)
  }, [filtroReceita, filtroInicio, filtroFim])

  useEffect(() => {
    fetch('/api/receitas').then((r) => r.json()).then(setReceitas)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const totalQuantidade = vendas.reduce((acc, v) => acc + Number(v.quantidade), 0)
  const totalFaturamento = vendas.reduce((acc, v) => acc + Number(v.valorTotal), 0)
  const totalPendentePagamento = vendas.filter((v) => !v.pago).reduce((acc, v) => acc + Number(v.valorTotal), 0)

  function exportarCSV() {
    const cabecalho = ['Data', 'Cliente', 'Receita', 'Quantidade', 'Preço Unitário', 'Valor Total', 'Pago', 'Entregue', 'Forma de Pagamento', 'Observações', 'Usuário']
    const linhas = vendas.map((v) => [
      new Date(v.dataVenda).toLocaleString('pt-BR'),
      v.cliente,
      v.receita.nome,
      Number(v.quantidade).toFixed(3),
      Number(v.precoUnitario).toFixed(2),
      Number(v.valorTotal).toFixed(2),
      v.pago ? 'SIM' : 'NÃO',
      v.entregue ? 'SIM' : 'NÃO',
      v.formaPagamento || '',
      v.observacoes || '',
      v.usuario.nome,
    ])
    const csv = [cabecalho, ...linhas].map((l) => l.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'vendas.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatarData = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendas</h1>
          <p className="text-sm text-gray-500 mt-1">Histórico de vendas registradas</p>
        </div>
        <Link
          href="/vendas/nova"
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Registrar Venda
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Quantidade vendida (filtro)</p>
          <p className="text-2xl font-bold text-gray-900">
            {totalQuantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Faturamento (filtro)</p>
          <p className="text-2xl font-bold text-gray-900">
            R$ {totalFaturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">A receber (não pago)</p>
          <p className={`text-2xl font-bold ${totalPendentePagamento > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            R$ {totalPendentePagamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Receita</label>
            <select
              value={filtroReceita}
              onChange={(e) => setFiltroReceita(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Todas</option>
              {receitas.map((r) => (
                <option key={r.id} value={r.id}>{r.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">De</label>
            <input
              type="date"
              value={filtroInicio}
              onChange={(e) => setFiltroInicio(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Até</label>
            <input
              type="date"
              value={filtroFim}
              onChange={(e) => setFiltroFim(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          {(filtroReceita || filtroInicio || filtroFim) && (
            <button
              onClick={() => { setFiltroReceita(''); setFiltroInicio(''); setFiltroFim('') }}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Limpar filtros
            </button>
          )}
          <div className="ml-auto">
            <button
              onClick={exportarCSV}
              disabled={vendas.length === 0}
              className="text-sm text-brand-600 hover:text-brand-800 font-medium border border-brand-300 px-3 py-1.5 rounded-lg disabled:opacity-40"
            >
              Exportar CSV
            </button>
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Histórico de Vendas</h2>
        <span className="text-sm text-gray-500">{vendas.length} registro(s)</span>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Carregando...</p>
      ) : vendas.length === 0 ? (
        <div className="text-center py-10 text-gray-400 bg-white border border-gray-200 rounded-xl">
          <p>Nenhuma venda encontrada</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Data</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Receita</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Qtd.</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vendas.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatarData(v.dataVenda)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{v.cliente}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 font-medium">{v.receita.nome}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">
                    {Number(v.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                    R$ {Number(v.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${v.pago ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {v.pago ? 'Pago' : 'Não pago'}
                      </span>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${v.entregue ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                        {v.entregue ? 'Entregue' : 'Pendente'}
                      </span>
                    </div>
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
