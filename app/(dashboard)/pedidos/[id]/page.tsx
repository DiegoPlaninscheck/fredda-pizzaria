'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import Transcricao, { MensagemTranscricao } from '@/components/Transcricao'
import { formatarTelefone, STATUS_PEDIDO_LABEL, STATUS_PEDIDO_STYLE } from '@/lib/pedidos-ui'

interface Pedido {
  id: number
  status: 'PENDENTE' | 'CONFIRMADO' | 'ENTREGUE' | 'CANCELADO'
  canal: 'WHATSAPP' | 'MANUAL'
  tipoEntrega: 'RETIRADA' | 'ENTREGA'
  enderecoEntrega: string | null
  formaPagamento: string | null
  dataEntregaDesejada: string | null
  observacoes: string | null
  valorTotal: string
  createdAt: string
  cliente: { nome: string | null; telefone: string }
  itens: { id: string; quantidade: string; precoUnitario: string; receita: { id: string; nome: string } }[]
  conversa: { id: string; status: string; mensagens: MensagemTranscricao[] } | null
}

const AVISO_NOTIFICACAO: Record<string, string> = {
  nao_configurado: 'Status atualizado. O WhatsApp não está configurado neste ambiente — o aviso ficou só registrado na conversa.',
  fora_da_janela: 'Status atualizado, mas o cliente não foi avisado: passaram-se mais de 24h desde a última mensagem dele (o WhatsApp exige um template aprovado).',
  sem_conversa: 'Status atualizado. O cliente não tem conversa no WhatsApp para ser avisado.',
  erro: 'Status atualizado, mas houve um erro ao avisar o cliente pelo WhatsApp. Veja os logs do servidor.',
}

const moeda = (v: string) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

export default function PedidoPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    const res = await fetch(`/api/pedidos/${id}`)
    if (res.ok) setPedido(await res.json())
    else setErro('Pedido não encontrado')
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  async function alterarStatus(status: Pedido['status'], confirmacao: string) {
    if (!confirm(confirmacao)) return
    setErro('')
    setAviso('')
    setSalvando(true)
    const res = await fetch(`/api/pedidos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setSalvando(false)
    const d = await res.json()
    if (!res.ok) {
      setErro(d.error || 'Erro ao atualizar pedido')
    } else if (AVISO_NOTIFICACAO[d.notificacao]) {
      setAviso(AVISO_NOTIFICACAO[d.notificacao])
    }
    carregar()
  }

  if (!pedido) {
    return <p className="text-sm text-gray-500">{erro || 'Carregando...'}</p>
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <button onClick={() => router.push('/pedidos')} className="text-sm text-gray-500 hover:text-gray-700">← Pedidos</button>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <h1 className="text-2xl font-bold text-gray-900">Pedido #{pedido.id}</h1>
          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_PEDIDO_STYLE[pedido.status]}`}>
            {STATUS_PEDIDO_LABEL[pedido.status]}
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Recebido em {new Date(pedido.createdAt).toLocaleString('pt-BR')} via {pedido.canal === 'WHATSAPP' ? 'WhatsApp' : 'cadastro manual'}
        </p>
      </div>

      {erro && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-4">{erro}</p>}
      {aviso && <p className="text-sm text-yellow-800 bg-yellow-50 px-3 py-2 rounded-lg mb-4">{aviso}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Itens</h2>
            <ul className="divide-y divide-gray-100">
              {pedido.itens.map((i) => (
                <li key={i.id} className="flex justify-between gap-3 py-2 text-sm">
                  <span className="text-gray-900">{Number(i.quantidade)}x {i.receita.nome}</span>
                  <span className="text-gray-600 whitespace-nowrap">
                    {moeda(String(Number(i.precoUnitario) * Number(i.quantidade)))}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between pt-3 mt-1 border-t border-gray-200 text-sm font-bold text-gray-900">
              <span>Total</span>
              <span>{moeda(pedido.valorTotal)}</span>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-2 text-sm">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Cliente e entrega</h2>
            <p><span className="text-gray-500">Cliente:</span> {pedido.cliente.nome || '—'}</p>
            <p><span className="text-gray-500">WhatsApp:</span> {formatarTelefone(pedido.cliente.telefone)}</p>
            <p>
              <span className="text-gray-500">Tipo:</span> {pedido.tipoEntrega === 'ENTREGA' ? 'Entrega' : 'Retirada na pizzaria'}
            </p>
            {pedido.enderecoEntrega && <p><span className="text-gray-500">Endereço:</span> {pedido.enderecoEntrega}</p>}
            {pedido.dataEntregaDesejada && (
              <p><span className="text-gray-500">Data desejada:</span> {new Date(pedido.dataEntregaDesejada).toLocaleDateString('pt-BR')}</p>
            )}
            <p><span className="text-gray-500">Pagamento:</span> {pedido.formaPagamento || '—'}</p>
            {pedido.observacoes && <p><span className="text-gray-500">Observações:</span> {pedido.observacoes}</p>}
          </div>

          <div className="flex flex-wrap gap-3">
            {pedido.status === 'PENDENTE' && (
              <button
                disabled={salvando}
                onClick={() => alterarStatus('CONFIRMADO', 'Confirmar este pedido? As vendas serão registradas e o cliente será avisado.')}
                className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
              >
                Confirmar pedido
              </button>
            )}
            {pedido.status === 'CONFIRMADO' && (
              <button
                disabled={salvando}
                onClick={() => alterarStatus('ENTREGUE', 'Marcar como entregue? O cliente será avisado.')}
                className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
              >
                Marcar como entregue
              </button>
            )}
            {['PENDENTE', 'CONFIRMADO'].includes(pedido.status) && (
              <button
                disabled={salvando}
                onClick={() => alterarStatus('CANCELADO', 'Cancelar este pedido? As pizzas voltam para o estoque e o cliente será avisado.')}
                className="text-sm text-red-600 hover:text-red-800 border border-red-200 hover:bg-red-50 disabled:opacity-50 px-4 py-2 rounded-lg"
              >
                Cancelar pedido
              </button>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Conversa</h2>
            {pedido.conversa && (
              <Link href={`/pedidos/conversas/${pedido.conversa.id}`} className="text-xs text-brand-600 hover:underline">
                Responder cliente →
              </Link>
            )}
          </div>
          {pedido.conversa
            ? <Transcricao mensagens={pedido.conversa.mensagens} />
            : <p className="text-sm text-gray-400">Pedido sem conversa vinculada.</p>}
        </div>
      </div>
    </div>
  )
}
