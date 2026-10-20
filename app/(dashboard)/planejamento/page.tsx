'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { adicionarSemanas, formatarSemana, segundaDaSemana } from '@/lib/semanas'
import type { ItemSugestao, Sugestao } from '@/lib/planejamento'

interface PlanoSalvo {
  id: string
  updatedAt: string
  modeloAtivo: string | null
  usuario: { nome: string }
  itens: { receitaId: string; planejado: string }[]
}

type Cobertura = 'previsao' | 'seguro'

const MAX_SEMANAS_A_FRENTE = 7
const NOMES_METODO: Record<string, string> = {
  hist_gradient_boosting_poisson: 'Modelo de IA',
  baseline_media_movel_4: 'Média das últimas 4 semanas',
}

const fmt = (n: number | null, casas = 1) =>
  n === null ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: casas })

function opcoesSemana() {
  const atual = segundaDaSemana()
  return Array.from({ length: MAX_SEMANAS_A_FRENTE }, (_, i) => adicionarSemanas(atual, i + 1))
}

export default function PlanejamentoPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'
  const semanas = useMemo(opcoesSemana, [])

  const [semana, setSemana] = useState(semanas[0])
  const [sugestao, setSugestao] = useState<Sugestao | null>(null)
  const [plano, setPlano] = useState<PlanoSalvo | null>(null)
  const [planejado, setPlanejado] = useState<Record<string, string>>({})
  const [cobertura, setCobertura] = useState<Cobertura>('previsao')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [criandoOrdem, setCriandoOrdem] = useState(false)
  const [treinando, setTreinando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [ordemCriadaId, setOrdemCriadaId] = useState('')

  const sugerido = useCallback(
    (i: ItemSugestao, c: Cobertura) => (c === 'seguro' ? i.sugeridoSeguro : i.sugerido),
    [],
  )

  const carregar = useCallback(async (s: string) => {
    setCarregando(true)
    setErro('')
    setMensagem('')
    setOrdemCriadaId('')
    const [resSug, resPlano] = await Promise.all([
      fetch(`/api/planejamento/sugestao?semana=${s}`),
      fetch(`/api/planejamento?semana=${s}`),
    ])
    const dadosSug = await resSug.json()
    const dadosPlano: PlanoSalvo | null = resPlano.ok ? await resPlano.json() : null
    if (!resSug.ok) {
      setErro(dadosSug.error ?? 'Erro ao gerar a sugestão')
      setSugestao(null)
      setCarregando(false)
      return
    }
    setSugestao(dadosSug)
    setPlano(dadosPlano)
    const salvos = new Map(dadosPlano?.itens.map((i) => [i.receitaId, String(Number(i.planejado))]))
    setPlanejado(Object.fromEntries(
      (dadosSug as Sugestao).itens.map((i) => [i.receitaId, salvos.get(i.receitaId) ?? String(i.sugerido)]),
    ))
    setCobertura('previsao')
    setCarregando(false)
  }, [])

  useEffect(() => { carregar(semana) }, [semana, carregar])

  function aplicarSugestao(c: Cobertura) {
    if (!sugestao) return
    setCobertura(c)
    setPlanejado(Object.fromEntries(sugestao.itens.map((i) => [i.receitaId, String(sugerido(i, c))])))
  }

  const totalPlanejado = Object.values(planejado).reduce((s, v) => s + (Number(v) || 0), 0)
  const totalPrevisto = sugestao?.itens.reduce((s, i) => s + (i.previsao ?? 0), 0) ?? 0

  async function salvar() {
    if (!sugestao) return
    setErro('')
    setMensagem('')
    for (const i of sugestao.itens) {
      const v = planejado[i.receitaId]
      if (v === '' || !(Number(v) >= 0)) { setErro(`Quantidade inválida para "${i.nome}"`); return }
    }
    setSalvando(true)
    const res = await fetch('/api/planejamento', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        semana,
        modeloAtivo: sugestao.modeloAtivo,
        itens: sugestao.itens.map((i) => ({
          receitaId: i.receitaId,
          previsao: i.previsao,
          limiteInferior: i.limiteInferior,
          limiteSuperior: i.limiteSuperior,
          metodo: i.metodo,
          estoqueInicial: i.estoqueProjetado,
          sugerido: sugerido(i, cobertura),
          planejado: Number(planejado[i.receitaId]),
        })),
      }),
    })
    const dados = await res.json()
    setSalvando(false)
    if (!res.ok) { setErro(dados.error ?? 'Erro ao salvar o plano'); return }
    setPlano(dados)
    setMensagem('Plano salvo.')
  }

  async function criarOrdem() {
    if (!sugestao) return
    const receitas = sugestao.itens
      .filter((i) => Number(planejado[i.receitaId]) > 0)
      .map((i) => ({ receitaId: i.receitaId, quantidade: Number(planejado[i.receitaId]) }))
    if (receitas.length === 0) { setErro('Nenhum sabor com quantidade planejada'); return }
    setErro('')
    setCriandoOrdem(true)
    const res = await fetch('/api/ordens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receitas,
        dataPrevista: semana,
        observacoes: `Plano de produção da semana ${formatarSemana(semana)}`,
      }),
    })
    const dados = await res.json()
    setCriandoOrdem(false)
    if (!res.ok) { setErro(dados.error ?? 'Erro ao criar a ordem'); return }
    setOrdemCriadaId(dados.id)
    setMensagem(dados.insuficientes?.length
      ? 'Ordem criada. Atenção: alguns insumos não tinham estoque suficiente.'
      : 'Ordem de produção criada.')
  }

  async function retreinar() {
    if (!confirm('Retreinar o modelo com o histórico de vendas atual? Isso pode levar alguns minutos.')) return
    setTreinando(true)
    setErro('')
    const res = await fetch('/api/planejamento/modelo', { method: 'POST' })
    const dados = await res.json()
    setTreinando(false)
    if (!res.ok) { setErro(dados.error ?? 'Erro ao retreinar o modelo'); return }
    setMensagem(`Modelo retreinado: ${NOMES_METODO[dados.modelo_ativo] ?? dados.modelo_ativo}.`)
    carregar(semana)
  }

  const alterado = plano
    ? sugestao?.itens.some((i) => {
      const salvo = plano.itens.find((p) => p.receitaId === i.receitaId)
      return !salvo || Number(salvo.planejado) !== Number(planejado[i.receitaId])
    })
    : true

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Planejamento de produção</h1>
          <p className="text-sm text-gray-500 mt-1">Sugestão semanal a partir da previsão de demanda</p>
        </div>
        <Link
          href="/planejamento/comparacao"
          className="text-sm text-brand-600 hover:text-brand-800 font-medium border border-brand-300 px-3 py-1.5 rounded-lg"
        >
          Planejado x realizado
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Semana</label>
          <select
            value={semana}
            onChange={(e) => setSemana(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {semanas.map((s, i) => (
              <option key={s} value={s}>{formatarSemana(s)}{i === 0 ? ' (próxima)' : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Sugestão para cobrir</label>
          <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-sm">
            <button
              type="button"
              onClick={() => aplicarSugestao('previsao')}
              disabled={!sugestao?.iaDisponivel}
              className={`px-3 py-1.5 ${cobertura === 'previsao' ? 'bg-brand-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'} disabled:opacity-40`}
            >
              Previsão
            </button>
            <button
              type="button"
              onClick={() => aplicarSugestao('seguro')}
              disabled={!sugestao?.iaDisponivel}
              title="Usa o limite superior do intervalo: menos risco de faltar massa"
              className={`px-3 py-1.5 border-l border-gray-300 ${cobertura === 'seguro' ? 'bg-brand-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'} disabled:opacity-40`}
            >
              Limite superior
            </button>
          </div>
        </div>
        {sugestao?.modeloAtivo && (
          <div className="text-xs text-gray-500 md:ml-auto">
            <p>Modelo: <span className="font-medium text-gray-700">{NOMES_METODO[sugestao.modeloAtivo] ?? sugestao.modeloAtivo}</span></p>
            {sugestao.treinadoEm && <p>Treinado em {new Date(sugestao.treinadoEm).toLocaleString('pt-BR')}</p>}
          </div>
        )}
        {isAdmin && (
          <button
            type="button"
            onClick={retreinar}
            disabled={treinando}
            className={`text-sm text-gray-600 hover:text-gray-900 border border-gray-300 px-3 py-1.5 rounded-lg disabled:opacity-40 ${sugestao?.modeloAtivo ? '' : 'md:ml-auto'}`}
          >
            {treinando ? 'Retreinando...' : 'Retreinar modelo'}
          </button>
        )}
      </div>

      {sugestao?.aviso && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{sugestao.aviso}</div>
      )}
      {erro && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
      {mensagem && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {mensagem}
          {ordemCriadaId && (
            <Link href={`/producao/${ordemCriadaId}`} className="ml-2 font-medium underline">Ver ordem</Link>
          )}
        </div>
      )}

      {carregando ? (
        <p className="text-gray-500 text-sm">Gerando sugestão...</p>
      ) : !sugestao ? null : sugestao.itens.length === 0 ? (
        <div className="text-center py-10 text-gray-400 bg-white border border-gray-200 rounded-xl">
          <p>Nenhuma receita ativa cadastrada</p>
        </div>
      ) : (
        <>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Sabor</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap" title="Estoque atual + ordens em andamento − demanda prevista até o início da semana">Estoque projetado</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Previsão de venda</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Sugerido</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Planejado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sugestao.itens.map((i) => (
                    <tr key={i.receitaId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                        {i.nome}
                        {i.metodo && (
                          <span className="block text-xs font-normal text-gray-400">{NOMES_METODO[i.metodo] ?? i.metodo}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 whitespace-nowrap">
                        {fmt(i.estoqueProjetado)}
                        <span className="block text-xs text-gray-400">
                          {fmt(i.estoqueAtual)} em estoque{i.emProducao > 0 ? ` + ${fmt(i.emProducao)} em produção` : ''}
                          {i.demandaAteLa > 0 ? ` − ${fmt(i.demandaAteLa)} até lá` : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 whitespace-nowrap">
                        {i.previsao === null ? <span className="text-gray-400">sem histórico</span> : fmt(i.previsao)}
                        {i.limiteInferior !== null && i.limiteSuperior !== null && (
                          <span className="block text-xs text-gray-400">{fmt(i.limiteInferior)} a {fmt(i.limiteSuperior)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-500">{sugerido(i, cobertura)}</td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          inputMode="numeric"
                          value={planejado[i.receitaId] ?? ''}
                          onChange={(e) => setPlanejado((p) => ({ ...p, [i.receitaId]: e.target.value }))}
                          className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700">Total</td>
                    <td />
                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-700">{sugestao.iaDisponivel ? fmt(totalPrevisto) : '—'}</td>
                    <td />
                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">{fmt(totalPlanejado, 3)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {sugestao.nivelConfianca !== null && (
            <p className="mt-2 text-xs text-gray-400">
              A faixa abaixo da previsão é o intervalo de {Math.round(sugestao.nivelConfianca * 100)}%: em 8 de cada 10 semanas a venda deve ficar dentro dela.
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : plano ? 'Atualizar plano' : 'Salvar plano'}
            </button>
            <button
              type="button"
              onClick={criarOrdem}
              disabled={criandoOrdem || !plano || alterado || !!ordemCriadaId}
              title={!plano || alterado ? 'Salve o plano antes de criar a ordem' : undefined}
              className="text-sm text-brand-600 hover:text-brand-800 font-medium border border-brand-300 px-4 py-2 rounded-lg disabled:opacity-40"
            >
              {criandoOrdem ? 'Criando...' : 'Criar ordem de produção'}
            </button>
            {plano && (
              <span className="text-xs text-gray-500">
                Plano salvo em {new Date(plano.updatedAt).toLocaleString('pt-BR')} por {plano.usuario.nome}
                {alterado ? ' · alterações não salvas' : ''}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
