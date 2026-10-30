'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Check, X } from 'lucide-react'
import { EVENTO_CONTADORES } from '@/components/Sidebar'
import Transcricao, { MensagemTranscricao } from '@/components/Transcricao'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardTitulo } from '@/components/ui/Card'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/components/ui/cn'
import {
  AVISO_NOTIFICACAO, formatarTelefone, NOTIFICACAO_OK, STATUS_PEDIDO_LABEL, STATUS_PEDIDO_STYLE,
} from '@/lib/pedidos-ui'

type Status = 'PENDENTE' | 'CONFIRMADO' | 'ENTREGUE' | 'CANCELADO'

interface Pedido {
  id: number
  status: Status
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

type NovoStatus = Exclude<Status, 'PENDENTE'>

const moeda = (v: string | number) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

/** Textos do diálogo, do botão e do aviso de cada ação. */
function descreverAcao(status: NovoStatus, pedido: Pedido) {
  const itens = pedido.itens.map((i) => `${Number(i.quantidade)}× ${i.receita.nome}`).join(', ')
  const unidades = pedido.itens.reduce((t, i) => t + Number(i.quantidade), 0)
  const cliente = pedido.cliente.nome || 'O cliente'
  const avisa = pedido.canal === 'WHATSAPP'

  switch (status) {
    case 'CONFIRMADO':
      return {
        titulo: `Confirmar o pedido #${pedido.id}?`,
        itens: [
          `Registra a venda de ${itens} (${moeda(pedido.valorTotal)})`,
          'As pizzas já estão reservadas no estoque',
          ...(avisa ? [`${cliente} recebe a confirmação no WhatsApp`] : []),
        ],
        botao: 'Confirmar pedido', carregando: 'Confirmando…', feito: 'confirmado',
        resumo: `${pedido.itens.length === 1 ? '1 venda registrada' : `${pedido.itens.length} vendas registradas`}`,
        perigo: false,
      }
    case 'ENTREGUE':
      return {
        titulo: 'Marcar como entregue?',
        itens: ['As vendas do pedido ficam marcadas como entregues', ...(avisa ? [`${cliente} recebe o aviso no WhatsApp`] : [])],
        botao: 'Marcar como entregue', carregando: 'Salvando…', feito: 'entregue',
        resumo: 'Vendas marcadas como entregues',
        perigo: false,
      }
    case 'CANCELADO':
      return {
        titulo: `Cancelar o pedido #${pedido.id}?`,
        itens: [
          `${unidades === 1 ? 'A pizza volta' : `As ${unidades} pizzas voltam`} para o estoque`,
          pedido.status === 'CONFIRMADO' ? 'As vendas registradas são desfeitas' : 'Nenhuma venda é registrada',
          ...(avisa ? [`${cliente} recebe o aviso de cancelamento no WhatsApp`] : []),
        ],
        botao: 'Cancelar pedido', carregando: 'Cancelando…', feito: 'cancelado',
        resumo: unidades === 1 ? 'A pizza voltou ao estoque' : `${unidades} pizzas voltaram ao estoque`,
        perigo: true,
      }
  }
}

/** Recebido → Confirmado → Entregue (ou Cancelado no lugar da etapa seguinte). */
function LinhaDoTempo({ pedido }: { pedido: Pedido }) {
  const cancelado = pedido.status === 'CANCELADO'
  const passo = { PENDENTE: 0, CONFIRMADO: 1, ENTREGUE: 2, CANCELADO: 0 }[pedido.status]
  const recebido = new Date(pedido.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  const etapas = [
    { titulo: 'Recebido', sub: recebido, feito: true },
    cancelado
      ? { titulo: 'Cancelado', sub: 'pedido encerrado', cancelado: true }
      : { titulo: 'Confirmado', sub: passo >= 1 ? 'vendas registradas' : 'aguardando', feito: passo >= 1 },
    { titulo: 'Entregue', sub: passo >= 2 ? 'concluído' : '—', feito: !cancelado && passo >= 2 },
  ]

  return (
    <ol aria-label="Andamento do pedido" className="grid grid-cols-3 gap-3 bg-white border border-[#e7e1cf] rounded-2xl px-5 py-4 mb-6">
      {etapas.map((e, i) => (
        <li key={e.titulo} className="flex items-center gap-3 min-w-0">
          <span className={cn(
            'flex-none w-8 h-8 rounded-full inline-flex items-center justify-center text-sm font-bold',
            e.cancelado ? 'bg-red-700 text-white' : e.feito ? 'bg-brand-700 text-white' : 'bg-creme-100 text-gray-500'
          )}>
            {e.cancelado ? <X className="w-4 h-4" aria-hidden="true" /> : e.feito ? <Check className="w-4 h-4" aria-hidden="true" /> : i + 1}
          </span>
          <div className="min-w-0">
            <p className={cn('text-sm font-semibold truncate', e.feito || e.cancelado ? 'text-brand-900' : 'text-gray-500')}>{e.titulo}</p>
            <p className="text-xs text-gray-500 truncate">{e.sub}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

export default function PedidoPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const confirmar = useConfirm()
  const toast = useToast()
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [naoEncontrado, setNaoEncontrado] = useState(false)
  const [salvando, setSalvando] = useState<NovoStatus | null>(null)

  const carregar = useCallback(async () => {
    const res = await fetch(`/api/pedidos/${id}`)
    if (res.ok) setPedido(await res.json())
    else setNaoEncontrado(true)
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  async function alterarStatus(status: NovoStatus) {
    if (!pedido) return
    const acao = descreverAcao(status, pedido)
    const ok = await confirmar({ titulo: acao.titulo, itens: acao.itens, confirmar: acao.botao, perigo: acao.perigo })
    if (!ok) return

    setSalvando(status)
    try {
      const res = await fetch(`/api/pedidos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.erro(`Não foi possível atualizar o pedido #${pedido.id}`, d.error || `O servidor respondeu ${res.status}.`)
      } else {
        const titulo = `Pedido #${pedido.id} ${acao.feito}`
        const aviso = AVISO_NOTIFICACAO[d.notificacao] ?? ''
        if (NOTIFICACAO_OK.includes(d.notificacao)) toast.sucesso(titulo, [acao.resumo, aviso].filter(Boolean).join(' · '))
        else toast.alerta(titulo, aviso || acao.resumo)
      }
    } catch {
      toast.erro('Sem conexão com o servidor', 'Verifique a internet e tente de novo.')
    } finally {
      setSalvando(null)
      carregar()
      window.dispatchEvent(new Event(EVENTO_CONTADORES))
    }
  }

  if (!pedido) {
    return naoEncontrado
      ? <p className="text-sm text-gray-500">Pedido não encontrado. <Link href="/pedidos" className="text-brand-700 font-medium">Voltar aos pedidos</Link></p>
      : <div className="max-w-5xl space-y-4 animate-pulse" aria-label="Carregando pedido">
          <div className="h-8 w-48 bg-creme-100 rounded-lg" />
          <div className="h-16 bg-creme-100 rounded-2xl" />
          <div className="h-64 bg-creme-100 rounded-2xl" />
        </div>
  }

  const ocupado = salvando !== null

  return (
    <div className="max-w-5xl">
      <div className="mb-5">
        <button onClick={() => router.push('/pedidos')} className="text-sm text-gray-500 hover:text-gray-800">← Pedidos</button>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <h1 className="font-display text-3xl font-bold text-brand-900">Pedido #{pedido.id}</h1>
          <Badge className={STATUS_PEDIDO_STYLE[pedido.status]}>{STATUS_PEDIDO_LABEL[pedido.status]}</Badge>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Recebido em {new Date(pedido.createdAt).toLocaleString('pt-BR')} via {pedido.canal === 'WHATSAPP' ? 'WhatsApp' : 'cadastro manual'}
        </p>
      </div>

      <LinhaDoTempo pedido={pedido} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <div className="space-y-5">
          <Card>
            <CardTitulo>Itens</CardTitulo>
            <ul className="divide-y divide-gray-100">
              {pedido.itens.map((i) => (
                <li key={i.id} className="flex justify-between gap-3 py-2 text-sm">
                  <span className="text-gray-900">{Number(i.quantidade)}× {i.receita.nome}</span>
                  <span className="text-gray-600 whitespace-nowrap">{moeda(Number(i.precoUnitario) * Number(i.quantidade))}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between pt-3 mt-1 border-t border-gray-200 text-sm font-bold text-gray-900">
              <span>Total</span>
              <span>{moeda(pedido.valorTotal)}</span>
            </div>
          </Card>

          <Card className="space-y-2 text-sm">
            <CardTitulo>Cliente e entrega</CardTitulo>
            <p><span className="text-gray-500">Cliente:</span> {pedido.cliente.nome || '—'}</p>
            <p><span className="text-gray-500">WhatsApp:</span> {formatarTelefone(pedido.cliente.telefone)}</p>
            <p><span className="text-gray-500">Tipo:</span> {pedido.tipoEntrega === 'ENTREGA' ? 'Entrega' : 'Retirada na pizzaria'}</p>
            {pedido.enderecoEntrega && <p><span className="text-gray-500">Endereço:</span> {pedido.enderecoEntrega}</p>}
            {pedido.dataEntregaDesejada && (
              <p><span className="text-gray-500">Data desejada:</span> {new Date(pedido.dataEntregaDesejada).toLocaleDateString('pt-BR')}</p>
            )}
            <p><span className="text-gray-500">Pagamento:</span> {pedido.formaPagamento || '—'}</p>
            {pedido.observacoes && <p><span className="text-gray-500">Observações:</span> {pedido.observacoes}</p>}
          </Card>

          <div className="flex flex-wrap gap-3">
            {pedido.status === 'PENDENTE' && (
              <Button
                disabled={ocupado}
                carregando={salvando === 'CONFIRMADO'}
                textoCarregando="Confirmando…"
                onClick={() => alterarStatus('CONFIRMADO')}
              >
                Confirmar pedido
              </Button>
            )}
            {pedido.status === 'CONFIRMADO' && (
              <Button
                disabled={ocupado}
                carregando={salvando === 'ENTREGUE'}
                textoCarregando="Salvando…"
                onClick={() => alterarStatus('ENTREGUE')}
              >
                Marcar como entregue
              </Button>
            )}
            {['PENDENTE', 'CONFIRMADO'].includes(pedido.status) && (
              <Button
                variante="perigo"
                disabled={ocupado}
                carregando={salvando === 'CANCELADO'}
                textoCarregando="Cancelando…"
                onClick={() => alterarStatus('CANCELADO')}
              >
                Cancelar pedido
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardTitulo
            acao={pedido.conversa && (
              <Link href={`/pedidos/conversas/${pedido.conversa.id}`} className="text-sm font-semibold text-brand-700 hover:text-brand-900">
                Responder cliente →
              </Link>
            )}
          >
            Conversa
          </CardTitulo>
          {pedido.conversa
            ? <Transcricao mensagens={pedido.conversa.mensagens} />
            : <p className="text-sm text-gray-400">Pedido sem conversa vinculada.</p>}
        </Card>
      </div>
    </div>
  )
}
