'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import Transcricao, { MensagemTranscricao } from '@/components/Transcricao'
import { formatarTelefone, STATUS_PEDIDO_LABEL } from '@/lib/pedidos-ui'

interface Conversa {
  id: string
  status: 'BOT' | 'HUMANO' | 'ENCERRADA'
  cliente: { nome: string | null; telefone: string; endereco: string | null }
  mensagens: MensagemTranscricao[]
  pedidos: { id: number; status: string; valorTotal: string }[]
}

const STATUS_CONVERSA: Record<Conversa['status'], { label: string; style: string }> = {
  BOT: { label: 'Atendimento automático', style: 'bg-brand-50 text-brand-700' },
  HUMANO: { label: 'Com a equipe', style: 'bg-orange-100 text-orange-800' },
  ENCERRADA: { label: 'Encerrada', style: 'bg-gray-100 text-gray-600' },
}

export default function ConversaPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [conversa, setConversa] = useState<Conversa | null>(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    const res = await fetch(`/api/conversas/${id}`)
    if (res.ok) setConversa(await res.json())
    else setErro('Conversa não encontrada')
  }, [id])

  useEffect(() => {
    carregar()
    const interval = setInterval(carregar, 10000)
    return () => clearInterval(interval)
  }, [carregar])

  async function alterarStatus(status: 'BOT' | 'HUMANO') {
    setErro('')
    const res = await fetch(`/api/conversas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) setErro((await res.json()).error || 'Erro ao atualizar conversa')
    carregar()
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    setErro('')
    setEnviando(true)
    const res = await fetch(`/api/conversas/${id}/mensagens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto }),
    })
    setEnviando(false)
    if (res.ok) {
      setTexto('')
      carregar()
    } else {
      setErro((await res.json()).error || 'Erro ao enviar mensagem')
    }
  }

  if (!conversa) return <p className="text-sm text-gray-500">{erro || 'Carregando...'}</p>

  const status = STATUS_CONVERSA[conversa.status]

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <button onClick={() => router.push('/pedidos')} className="text-sm text-gray-500 hover:text-gray-700">← Pedidos</button>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <h1 className="text-2xl font-bold text-gray-900">
            {conversa.cliente.nome || formatarTelefone(conversa.cliente.telefone)}
          </h1>
          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${status.style}`}>{status.label}</span>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          WhatsApp {formatarTelefone(conversa.cliente.telefone)}
          {conversa.cliente.endereco && <> · {conversa.cliente.endereco}</>}
        </p>
        {conversa.pedidos.length > 0 && (
          <p className="text-sm mt-2 flex flex-wrap gap-x-3">
            {conversa.pedidos.map((p) => (
              <Link key={p.id} href={`/pedidos/${p.id}`} className="text-brand-600 hover:underline">
                Pedido #{p.id} ({STATUS_PEDIDO_LABEL[p.status]})
              </Link>
            ))}
          </p>
        )}
      </div>

      {erro && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-4">{erro}</p>}

      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
        <Transcricao mensagens={conversa.mensagens} />

        {conversa.status !== 'ENCERRADA' && (
          <>
            <form onSubmit={enviar} className="flex flex-col sm:flex-row gap-2">
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={2}
                placeholder="Responder ao cliente pelo WhatsApp..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                type="submit"
                disabled={enviando || !texto.trim()}
                className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
              >
                {enviando ? 'Enviando...' : 'Enviar'}
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
              {conversa.status === 'HUMANO' ? (
                <>
                  <button
                    onClick={() => alterarStatus('BOT')}
                    className="text-sm text-brand-700 border border-brand-200 hover:bg-brand-50 px-3 py-1.5 rounded-lg"
                  >
                    Devolver ao atendimento automático
                  </button>
                  <span className="text-xs text-gray-500">O chatbot está pausado enquanto a equipe atende.</span>
                </>
              ) : (
                <>
                  <button
                    onClick={() => alterarStatus('HUMANO')}
                    className="text-sm text-orange-700 border border-orange-200 hover:bg-orange-50 px-3 py-1.5 rounded-lg"
                  >
                    Assumir conversa
                  </button>
                  <span className="text-xs text-gray-500">Pausa o chatbot para a equipe responder.</span>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
