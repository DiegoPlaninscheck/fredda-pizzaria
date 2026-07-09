'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Insumo {
  id: string
  nome: string
  unidade: string
  estoqueAtual: string
  estoqueMinimo: string
  precoUnitario: string | null
  estoqueAbaixoMinimo: boolean
  ativo: boolean
  categoria: { nome: string }
  fornecedor: { nome: string } | null
}

interface Movimentacao {
  id: string
  tipo: 'ENTRADA' | 'SAIDA'
  quantidade: string
  lote: string | null
  motivo: string | null
  dataVencimento: string | null
  precoUnitario: string | null
  createdAt: string
  saldoApos: string
  fornecedor: { nome: string } | null
  usuario: { nome: string }
}

export default function DetalheInsumoPage() {
  const { id } = useParams<{ id: string }>()
  const [insumo, setInsumo] = useState<Insumo | null>(null)
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroInicio, setFiltroInicio] = useState('')
  const [filtroFim, setFiltroFim] = useState('')

  const carregarMovimentacoes = useCallback(async () => {
    const params = new URLSearchParams()
    if (filtroTipo) params.set('tipo', filtroTipo)
    if (filtroInicio) params.set('dataInicio', filtroInicio)
    if (filtroFim) params.set('dataFim', filtroFim)
    const res = await fetch(`/api/insumos/${id}/movimentacoes?${params}`)
    if (res.ok) setMovimentacoes(await res.json())
  }, [id, filtroTipo, filtroInicio, filtroFim])

  useEffect(() => {
    Promise.all([
      fetch(`/api/insumos/${id}`).then((r) => r.json()),
    ]).then(([ins]) => {
      setInsumo(ins)
      setLoading(false)
    })
  }, [id])

  useEffect(() => {
    if (!loading) carregarMovimentacoes()
  }, [loading, carregarMovimentacoes])

  function exportarCSV() {
    const cabecalho = ['Data', 'Tipo', 'Quantidade', 'Saldo Após', 'Lote', 'Motivo/Fornecedor', 'Usuário']
    const linhas = movimentacoes.map((m) => [
      new Date(m.createdAt).toLocaleString('pt-BR'),
      m.tipo,
      Number(m.quantidade).toFixed(3),
      Number(m.saldoApos).toFixed(3),
      m.lote || '',
      m.motivo || m.fornecedor?.nome || '',
      m.usuario.nome,
    ])
    const csv = [cabecalho, ...linhas].map((l) => l.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `movimentacoes-${insumo?.nome ?? id}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <p className="text-gray-500 text-sm">Carregando...</p>
  if (!insumo) return <p className="text-red-600 text-sm">Insumo não encontrado</p>

  const formatarData = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div>
      <div className="mb-6">
        <Link href="/estoque" className="text-sm text-gray-500 hover:text-gray-700">
          ← Estoque
        </Link>
        <div className="flex items-start justify-between mt-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{insumo.nome}</h1>
            <p className="text-sm text-gray-500 mt-1">{insumo.categoria.nome}</p>
          </div>
          <Link
            href={`/estoque/${id}/movimentacao`}
            className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Registrar Movimentação
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className={`bg-white border rounded-xl p-4 shadow-sm ${insumo.estoqueAbaixoMinimo ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Estoque Atual</p>
          <p className={`text-2xl font-bold ${insumo.estoqueAbaixoMinimo ? 'text-red-600' : 'text-gray-900'}`}>
            {Number(insumo.estoqueAtual).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
          </p>
          <p className="text-sm text-gray-500">{insumo.unidade}</p>
          {insumo.estoqueAbaixoMinimo && (
            <p className="text-xs text-red-600 font-medium mt-1">Abaixo do mínimo!</p>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Estoque Mínimo</p>
          <p className="text-2xl font-bold text-gray-900">
            {Number(insumo.estoqueMinimo).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
          </p>
          <p className="text-sm text-gray-500">{insumo.unidade}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Preço Unitário</p>
          <p className="text-2xl font-bold text-gray-900">
            {insumo.precoUnitario
              ? `R$ ${Number(insumo.precoUnitario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
              : '—'}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Fornecedor Padrão</p>
          <p className="text-base font-semibold text-gray-900 truncate">
            {insumo.fornecedor?.nome || '—'}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Todos</option>
              <option value="ENTRADA">Entrada</option>
              <option value="SAIDA">Saída</option>
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
          {(filtroTipo || filtroInicio || filtroFim) && (
            <button
              onClick={() => { setFiltroTipo(''); setFiltroInicio(''); setFiltroFim('') }}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Limpar filtros
            </button>
          )}
          <div className="ml-auto">
            <button
              onClick={exportarCSV}
              disabled={movimentacoes.length === 0}
              className="text-sm text-brand-600 hover:text-brand-800 font-medium border border-brand-300 px-3 py-1.5 rounded-lg disabled:opacity-40"
            >
              Exportar CSV
            </button>
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Histórico de Movimentações</h2>
        <span className="text-sm text-gray-500">{movimentacoes.length} registro(s)</span>
      </div>

      {movimentacoes.length === 0 ? (
        <div className="text-center py-10 text-gray-400 bg-white border border-gray-200 rounded-xl">
          <p>Nenhuma movimentação encontrada</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Data</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Quantidade</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Saldo Após</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Lote</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Motivo / Fornecedor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Usuário</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {movimentacoes.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatarData(m.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${m.tipo === 'ENTRADA' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {m.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                    {m.tipo === 'ENTRADA' ? '+' : '−'}{Number(m.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {insumo.unidade}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600">
                    {Number(m.saldoApos).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {insumo.unidade}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{m.lote || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {m.motivo || m.fornecedor?.nome || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{m.usuario.nome}</td>
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
