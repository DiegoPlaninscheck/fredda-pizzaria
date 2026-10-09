'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { formatarTelefone, STATUS_PEDIDO_LABEL, STATUS_PEDIDO_STYLE } from '@/lib/pedidos-ui'

interface PedidoResumo {
  id: number
  status: 'PENDENTE' | 'CONFIRMADO' | 'ENTREGUE' | 'CANCELADO'
  canal: 'WHATSAPP' | 'MANUAL'
  tipoEntrega: 'RETIRADA' | 'ENTREGA'
  valorTotal: string
  createdAt: string
  dataEntregaDesejada: string | null
  cliente: { nome: string | null; telefone: string }
  itens: { id: string; quantidade: string; receita: { nome: string } }[]
}

interface ConversaAguardando {
  id: string
  ultimaMensagemEm: string
  cliente: { nome: string | null; telefone: string }
  mensagens: { texto: string; direcao: string }[]
}

const FILTROS = [
  { valor: '', label: 'Em aberto' },
  { valor: 'PENDENTE', label: 'Aguardando confirmação' },
  { valor: 'CONFIRMADO', label: 'Confirmados' },
  { valor: 'ENTREGUE', label: 'Entregues' },
  { valor: 'CANCELADO', label: 'Cancelados' },
  { valor: 'TODOS', label: 'Todos' },
]

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<PedidoResumo[]>([])
  const [conversas, setConversas] = useState<ConversaAguardando[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')

  const carregar = useCallback(async () => {
    const qs = filtro ? `?status=${filtro}` : ''
    const [resPedidos, resConversas] = await Promise.all([fetch(`/api/pedidos${qs}`), fetch('/api/conversas')])
    if (resPedidos.ok) setPedidos(await resPedidos.json())
    if (resConversas.ok) setConversas(await resConversas.json())
    setLoading(false)
  }, [filtro])

  useEffect(() => {
    carregar()
    const interval = setInterval(carregar, 15000)
    return () => clearInterval(interval)
  }, [carregar])

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
          <p className="text-sm text-gray-500 mt-1">Pedidos feitos pelos clientes no WhatsApp (atualiza a cada 15s)</p>
        </div>
        <Link
          href="/pedidos/simulador"
          className="text-sm text-brand-600 hover:text-brand-800 font-medium border border-brand-300 px-4 py-2 rounded-lg"
        >
          💬 Simular cliente
        </Link>
      </div>

      {conversas.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
          <h2 className="text-sm font-semibold text-orange-800 mb-3">
            Clientes aguardando um atendente ({conversas.length})
          </h2>
          <ul className="space-y-2">
            {conversas.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/pedidos/conversas/${c.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-lg px-3 py-2 border border-orange-100 hover:border-orange-300"
                >
                  <span className="text-sm font-medium text-gray-900">
                    {c.cliente.nome || formatarTelefone(c.cliente.telefone)}
                  </span>
                  <span className="text-xs text-gray-500 truncate max-w-full sm:max-w-md">
                    {c.mensagens[0]?.texto}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            onClick={() => setFiltro(f.valor)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              filtro === f.valor
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Carregando...</p>
      ) : pedidos.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">Nenhum pedido encontrado</p>
          <p className="text-sm mt-1">Os pedidos feitos pelo chatbot do WhatsApp aparecem aqui</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nº</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Itens</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Entrega</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pedidos.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-semibold">
                      <Link href={`/pedidos/${p.id}`} className="text-brand-600 hover:underline">#{p.id}</Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(p.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                      {p.cliente.nome || formatarTelefone(p.cliente.telefone)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {p.itens.map((i) => `${Number(i.quantidade)}x ${i.receita.nome}`).join(', ')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                      {p.tipoEntrega === 'ENTREGA' ? 'Entrega' : 'Retirada'}
                      {p.dataEntregaDesejada && (
                        <span className="block text-xs text-gray-400">
                          {new Date(p.dataEntregaDesejada).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900 whitespace-nowrap">
                      R$ {Number(p.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${STATUS_PEDIDO_STYLE[p.status]}`}>
                        {STATUS_PEDIDO_LABEL[p.status]}
                      </span>
                    </td>
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
