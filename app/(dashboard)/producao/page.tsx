'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface OrdemResumo {
  id: string
  status: 'PLANEJADA' | 'EM_ANDAMENTO' | 'PAUSADA' | 'CONCLUIDA' | 'CANCELADA'
  quantidade: string
  dataPrevista: string | null
  createdAt: string
  receita: { nome: string }
  usuario: { nome: string }
  etapas: { status: string; nome: string; ordem: number }[]
}

const STATUS_LABEL: Record<string, string> = {
  PLANEJADA: 'Planejada',
  EM_ANDAMENTO: 'Em andamento',
  PAUSADA: 'Pausada',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
}

const STATUS_STYLE: Record<string, string> = {
  PLANEJADA: 'bg-gray-100 text-gray-700',
  EM_ANDAMENTO: 'bg-blue-100 text-blue-700',
  PAUSADA: 'bg-yellow-100 text-yellow-700',
  CONCLUIDA: 'bg-green-100 text-green-700',
  CANCELADA: 'bg-red-100 text-red-700',
}

const STATUS_BORDER: Record<string, string> = {
  PLANEJADA: 'border-gray-200',
  EM_ANDAMENTO: 'border-blue-300',
  PAUSADA: 'border-yellow-300',
  CONCLUIDA: 'border-green-200',
  CANCELADA: 'border-red-200',
}

const ETAPA_NOME: Record<string, string> = {
  MISTURA: 'Mistura',
  DESCANSO_INICIAL: 'Descanso inicial',
  FERMENTACAO_LONGA: 'Fermentação longa',
  MODELAGEM: 'Modelagem',
  CONGELAMENTO: 'Congelamento',
}

function etapaAtual(etapas: OrdemResumo['etapas']): string {
  const ativa = etapas.find((e) => e.status === 'EM_ANDAMENTO' || e.status === 'PAUSADA')
  if (ativa) return ETAPA_NOME[ativa.nome] || ativa.nome
  const pendente = [...etapas].sort((a, b) => a.ordem - b.ordem).find((e) => e.status === 'PENDENTE')
  if (pendente) return `Próxima: ${ETAPA_NOME[pendente.nome] || pendente.nome}`
  return 'Todas concluídas'
}

export default function ProducaoPage() {
  const [ordens, setOrdens] = useState<OrdemResumo[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('')

  const carregar = useCallback(async () => {
    const qs = filtroStatus ? `?status=${filtroStatus}` : ''
    const res = await fetch(`/api/ordens${qs}`)
    if (res.ok) setOrdens(await res.json())
    setLoading(false)
  }, [filtroStatus])

  useEffect(() => {
    carregar()
    const interval = setInterval(carregar, 15000)
    return () => clearInterval(interval)
  }, [carregar])

  async function cancelar(id: string) {
    if (!confirm('Cancelar esta ordem de produção?')) return
    const res = await fetch(`/api/ordens/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELADA' }),
    })
    if (res.ok) carregar()
    else {
      const d = await res.json()
      alert(d.error || 'Erro ao cancelar')
    }
  }

  const ativas = ordens.filter((o) => ['EM_ANDAMENTO', 'PAUSADA'].includes(o.status))
  const outras = ordens.filter((o) => !['EM_ANDAMENTO', 'PAUSADA'].includes(o.status))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Produção</h1>
          <p className="text-sm text-gray-500 mt-1">Ordens de produção e controle de fermentação</p>
        </div>
        <Link
          href="/producao/nova"
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Nova Ordem
        </Link>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {['', 'PLANEJADA', 'EM_ANDAMENTO', 'PAUSADA', 'CONCLUIDA', 'CANCELADA'].map((s) => (
          <button
            key={s}
            onClick={() => setFiltroStatus(s)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              filtroStatus === s
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'
            }`}
          >
            {s === '' ? 'Todas' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Carregando...</p>
      ) : ordens.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">Nenhuma ordem encontrada</p>
          <p className="text-sm mt-1">Crie uma nova ordem de produção para começar</p>
        </div>
      ) : (
        <div className="space-y-6">
          {ativas.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Em andamento / Pausadas</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ativas.map((o) => (
                  <OrdemCard key={o.id} ordem={o} onCancelar={cancelar} />
                ))}
              </div>
            </div>
          )}

          {outras.length > 0 && (
            <div>
              {ativas.length > 0 && (
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Outras ordens</p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {outras.map((o) => (
                  <OrdemCard key={o.id} ordem={o} onCancelar={cancelar} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function OrdemCard({
  ordem,
  onCancelar,
}: {
  ordem: OrdemResumo
  onCancelar: (id: string) => void
}) {
  const concluidas = ordem.etapas.filter((e) => e.status === 'CONCLUIDA').length
  const total = ordem.etapas.length
  const progresso = total > 0 ? Math.round((concluidas / total) * 100) : 0

  return (
    <div className={`bg-white border rounded-xl shadow-sm overflow-hidden ${STATUS_BORDER[ordem.status]}`}>
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">{ordem.receita.nome}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {Number(ordem.quantidade)} un. · {ordem.usuario.nome}
            </p>
          </div>
          <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${STATUS_STYLE[ordem.status]}`}>
            {STATUS_LABEL[ordem.status]}
          </span>
        </div>

        {total > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{etapaAtual(ordem.etapas)}</span>
              <span>{concluidas}/{total} etapas</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full transition-all"
                style={{ width: `${progresso}%` }}
              />
            </div>
          </div>
        )}

        {ordem.dataPrevista && (
          <p className="text-xs text-gray-400 mt-2">
            Prevista: {new Date(ordem.dataPrevista).toLocaleDateString('pt-BR')}
          </p>
        )}
      </div>

      <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50">
        <Link
          href={`/producao/${ordem.id}`}
          className="text-sm text-brand-600 hover:text-brand-800 font-medium"
        >
          Ver detalhes →
        </Link>
        {!['CONCLUIDA', 'CANCELADA'].includes(ordem.status) && (
          <button
            onClick={() => onCancelar(ordem.id)}
            className="text-xs text-red-500 hover:text-red-700 font-medium"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}
