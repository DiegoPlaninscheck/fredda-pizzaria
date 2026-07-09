'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'

interface RegistroCondicoes {
  id: string
  temperatura: string | null
  umidade: string | null
  observacoes: string | null
  createdAt: string
}

interface Etapa {
  id: string
  nome: string
  ordem: number
  status: 'PENDENTE' | 'EM_ANDAMENTO' | 'PAUSADA' | 'CONCLUIDA'
  duracaoMinutos: number
  minutosDecorridos: number
  iniciadaEm: string | null
  concluidaEm: string | null
  registros: RegistroCondicoes[]
}

interface Ordem {
  id: string
  status: string
  quantidade: string
  dataPrevista: string | null
  observacoes: string | null
  createdAt: string
  receita: {
    nome: string
    descricao: string | null
    insumos: { id: string; quantidade: string; insumo: { nome: string; unidade: string } }[]
  }
  usuario: { nome: string }
  etapas: Etapa[]
}

const NOME_ETAPA: Record<string, string> = {
  MISTURA: 'Mistura',
  DESCANSO_INICIAL: 'Descanso inicial',
  FERMENTACAO_LONGA: 'Fermentação longa',
  MODELAGEM: 'Modelagem',
  CONGELAMENTO: 'Congelamento',
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

function formatarTempo(minutos: number): string {
  if (minutos < 60) return `${minutos}min`
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function useTicker(etapa: Etapa): number {
  const [agora, setAgora] = useState(Date.now())
  useEffect(() => {
    if (etapa.status !== 'EM_ANDAMENTO') return
    const t = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [etapa.status])
  return agora
}

function EtapaCard({
  etapa,
  ordemStatus,
  onAcao,
  onNovoRegistro,
}: {
  etapa: Etapa
  ordemStatus: string
  onAcao: (etapaId: string, acao: string) => Promise<void>
  onNovoRegistro: (etapaId: string, data: { temperatura?: string; umidade?: string; observacoes?: string }) => Promise<void>
}) {
  const agora = useTicker(etapa)
  const [expanded, setExpanded] = useState(false)
  const [temperatura, setTemperatura] = useState('')
  const [umidade, setUmidade] = useState('')
  const [obsRegistro, setObsRegistro] = useState('')
  const [salvandoRegistro, setSalvandoRegistro] = useState(false)
  const [atualizando, setAtualizando] = useState(false)

  const minutosAtuais =
    etapa.status === 'EM_ANDAMENTO' && etapa.iniciadaEm
      ? etapa.minutosDecorridos + Math.floor((agora - new Date(etapa.iniciadaEm).getTime()) / 60000)
      : etapa.minutosDecorridos

  const progresso = etapa.duracaoMinutos > 0
    ? Math.min(100, Math.round((minutosAtuais / etapa.duracaoMinutos) * 100))
    : 0

  const ordemFinalizada = ['CONCLUIDA', 'CANCELADA'].includes(ordemStatus)

  async function executarAcao(acao: string) {
    setAtualizando(true)
    await onAcao(etapa.id, acao)
    setAtualizando(false)
  }

  async function salvarRegistro() {
    if (!temperatura && !umidade && !obsRegistro.trim()) return
    setSalvandoRegistro(true)
    await onNovoRegistro(etapa.id, {
      temperatura: temperatura || undefined,
      umidade: umidade || undefined,
      observacoes: obsRegistro.trim() || undefined,
    })
    setTemperatura('')
    setUmidade('')
    setObsRegistro('')
    setSalvandoRegistro(false)
  }

  const podeIniciar = etapa.status === 'PENDENTE' || etapa.status === 'PAUSADA'
  const podePausar = etapa.status === 'EM_ANDAMENTO'
  const podeConcluir = etapa.status === 'EM_ANDAMENTO' || etapa.status === 'PAUSADA'

  return (
    <div className={`border rounded-xl overflow-hidden ${
      etapa.status === 'EM_ANDAMENTO' ? 'border-blue-300 shadow-sm shadow-blue-100' :
      etapa.status === 'CONCLUIDA' ? 'border-green-200' :
      etapa.status === 'PAUSADA' ? 'border-yellow-300' :
      'border-gray-200'
    }`}>
      <div
        className="px-4 py-3 bg-white flex items-center gap-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-gray-500 bg-gray-100 shrink-0">
          {etapa.ordem}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900">{NOME_ETAPA[etapa.nome] || etapa.nome}</p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[etapa.status]}`}>
              {STATUS_LABEL[etapa.status]}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  etapa.status === 'CONCLUIDA' ? 'bg-green-500' : 'bg-brand-500'
                }`}
                style={{ width: `${progresso}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 shrink-0">
              {formatarTempo(minutosAtuais)} / {formatarTempo(etapa.duracaoMinutos)}
            </span>
          </div>
        </div>
        <span className="text-gray-400 text-xs ml-1">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-4 space-y-4">
          {!ordemFinalizada && (
            <div className="flex gap-2 flex-wrap">
              {podeIniciar && (
                <button
                  disabled={atualizando}
                  onClick={() => executarAcao('INICIAR')}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  ▶ Iniciar
                </button>
              )}
              {podePausar && (
                <button
                  disabled={atualizando}
                  onClick={() => executarAcao('PAUSAR')}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-50 transition-colors"
                >
                  ⏸ Pausar
                </button>
              )}
              {podeConcluir && (
                <button
                  disabled={atualizando}
                  onClick={() => executarAcao('CONCLUIR')}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  ✓ Concluir
                </button>
              )}
            </div>
          )}

          {(etapa.status === 'EM_ANDAMENTO' || etapa.status === 'PAUSADA') && !ordemFinalizada && (
            <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-600">Registrar condições</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-500">Temperatura (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={temperatura}
                    onChange={(e) => setTemperatura(e.target.value)}
                    placeholder="Ex: 22.5"
                    className="mt-0.5 w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500">Umidade (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={umidade}
                    onChange={(e) => setUmidade(e.target.value)}
                    placeholder="Ex: 65"
                    className="mt-0.5 w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">Observação</label>
                <input
                  value={obsRegistro}
                  onChange={(e) => setObsRegistro(e.target.value)}
                  placeholder="Anotação opcional"
                  className="mt-0.5 w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <button
                onClick={salvarRegistro}
                disabled={salvandoRegistro || (!temperatura && !umidade && !obsRegistro.trim())}
                className="text-xs font-medium px-3 py-1.5 rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {salvandoRegistro ? 'Salvando...' : 'Salvar registro'}
              </button>
            </div>
          )}

          {etapa.registros.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Registros ({etapa.registros.length})</p>
              <div className="space-y-1.5">
                {etapa.registros.map((reg) => (
                  <div key={reg.id} className="bg-white border border-gray-100 rounded px-3 py-2 text-xs">
                    <div className="flex items-center gap-3 flex-wrap">
                      {reg.temperatura !== null && (
                        <span className="text-blue-600 font-medium">{Number(reg.temperatura)}°C</span>
                      )}
                      {reg.umidade !== null && (
                        <span className="text-green-600 font-medium">{Number(reg.umidade)}% UR</span>
                      )}
                      {reg.observacoes && (
                        <span className="text-gray-600">{reg.observacoes}</span>
                      )}
                      <span className="text-gray-400 ml-auto">
                        {new Date(reg.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {etapa.registros.length === 0 && etapa.status === 'CONCLUIDA' && (
            <p className="text-xs text-gray-400">Nenhum registro de condições nesta etapa.</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function OrdemDetalhe() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [ordem, setOrdem] = useState<Ordem | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    const res = await fetch(`/api/ordens/${id}`)
    if (res.ok) setOrdem(await res.json())
    else setErro('Ordem não encontrada')
    setLoading(false)
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  async function executarAcaoEtapa(etapaId: string, acao: string) {
    setErro('')
    const res = await fetch(`/api/ordens/${id}/etapas/${etapaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao }),
    })
    if (res.ok) {
      const etapaAtualizada = await res.json()
      setOrdem((prev) => {
        if (!prev) return prev
        const novasEtapas = prev.etapas.map((e) => e.id === etapaId ? { ...etapaAtualizada } : e)
        const pendentes = novasEtapas.filter((e) => e.status !== 'CONCLUIDA').length
        const algumAndamento = novasEtapas.some((e) => e.status === 'EM_ANDAMENTO')
        const algumPausado = novasEtapas.some((e) => e.status === 'PAUSADA')
        let novoStatus = prev.status
        if (pendentes === 0) novoStatus = 'CONCLUIDA'
        else if (algumAndamento) novoStatus = 'EM_ANDAMENTO'
        else if (algumPausado) novoStatus = 'PAUSADA'
        return { ...prev, etapas: novasEtapas, status: novoStatus }
      })
    } else {
      const d = await res.json()
      setErro(d.error || 'Erro ao executar ação')
    }
  }

  async function novoRegistro(
    etapaId: string,
    data: { temperatura?: string; umidade?: string; observacoes?: string }
  ) {
    setErro('')
    const res = await fetch(`/api/ordens/${id}/etapas/${etapaId}/condicoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const reg = await res.json()
      setOrdem((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          etapas: prev.etapas.map((e) =>
            e.id === etapaId ? { ...e, registros: [reg, ...e.registros] } : e
          ),
        }
      })
    } else {
      const d = await res.json()
      setErro(d.error || 'Erro ao salvar registro')
    }
  }

  async function cancelarOrdem() {
    if (!confirm('Cancelar esta ordem de produção?')) return
    const res = await fetch(`/api/ordens/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELADA' }),
    })
    if (res.ok) carregar()
  }

  if (loading) return <p className="text-gray-500 text-sm">Carregando...</p>
  if (!ordem) return <p className="text-red-500 text-sm">{erro || 'Ordem não encontrada'}</p>

  const finalizada = ['CONCLUIDA', 'CANCELADA'].includes(ordem.status)

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <button onClick={() => router.push('/producao')} className="text-sm text-gray-500 hover:text-gray-700">← Produção</button>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900">{ordem.receita.nome}</h1>
          <span className={`text-sm font-medium px-3 py-1 rounded-full ${STATUS_STYLE[ordem.status]}`}>
            {STATUS_LABEL[ordem.status]}
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {Number(ordem.quantidade)} unidades · {ordem.usuario.nome} ·{' '}
          {new Date(ordem.createdAt).toLocaleDateString('pt-BR')}
        </p>
        {ordem.dataPrevista && (
          <p className="text-xs text-gray-400 mt-0.5">
            Data prevista: {new Date(ordem.dataPrevista).toLocaleDateString('pt-BR')}
          </p>
        )}
        {ordem.observacoes && (
          <p className="text-xs text-gray-500 mt-1 italic">{ordem.observacoes}</p>
        )}
      </div>

      {erro && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</div>
      )}

      <div className="space-y-3 mb-6">
        {ordem.etapas.map((etapa) => (
          <EtapaCard
            key={etapa.id}
            etapa={etapa}
            ordemStatus={ordem.status}
            onAcao={executarAcaoEtapa}
            onNovoRegistro={novoRegistro}
          />
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Ingredientes da receita (por unidade)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ordem.receita.insumos.map((ri) => (
            <div key={ri.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
              <span className="text-sm text-gray-700">{ri.insumo.nome}</span>
              <span className="text-sm font-medium text-gray-900">
                {Number(ri.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {ri.insumo.unidade}
              </span>
            </div>
          ))}
        </div>
      </div>

      {!finalizada && (
        <button
          onClick={cancelarOrdem}
          className="text-sm text-red-500 hover:text-red-700 font-medium border border-red-200 hover:border-red-400 px-4 py-2 rounded-lg transition-colors"
        >
          Cancelar ordem
        </button>
      )}
    </div>
  )
}
