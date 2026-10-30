'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { formatarSemana } from '@/lib/semanas'
import type { LinhaComparacao, SemanaComparacao } from '@/lib/planejamento'

const fmt = (n: number | null, casas = 1) =>
  n === null || Number.isNaN(n) ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: casas })
const pct = (n: number | null) => (n === null || Number.isNaN(n) ? '—' : `${Math.round(n * 100)}%`)

const SITUACAO = {
  encerrada: { texto: 'Encerrada', classe: 'bg-gray-100 text-gray-600' },
  em_andamento: { texto: 'Em andamento', classe: 'bg-blue-100 text-blue-700' },
  futura: { texto: 'Futura', classe: 'bg-amber-100 text-amber-700' },
}

const soma = (linhas: LinhaComparacao[], campo: 'planejado' | 'produzido' | 'vendido' | 'previsao') =>
  linhas.reduce((s, l) => s + (l[campo] ?? 0), 0)

/** Indicadores das semanas encerradas: erro da previsão e aderência da produção ao plano. */
function indicadores(semanas: SemanaComparacao[]) {
  const linhas = semanas.filter((s) => s.situacao === 'encerrada').flatMap((s) => s.linhas)
  const comPrevisao = linhas.filter((l) => l.previsao !== null)
  const comIntervalo = comPrevisao.filter((l) => l.limiteInferior !== null && l.limiteSuperior !== null)
  const planejado = soma(linhas, 'planejado')
  return {
    semanas: semanas.filter((s) => s.situacao === 'encerrada').length,
    erroMedio: comPrevisao.length
      ? comPrevisao.reduce((s, l) => s + Math.abs(l.vendido - l.previsao!), 0) / comPrevisao.length
      : null,
    dentroDoIntervalo: comIntervalo.length
      ? comIntervalo.filter((l) => l.vendido >= l.limiteInferior! && l.vendido <= l.limiteSuperior!).length / comIntervalo.length
      : null,
    aderencia: planejado > 0 ? soma(linhas, 'produzido') / planejado : null,
  }
}

function Barra({ valor, maximo, cor, rotulo }: { valor: number; maximo: number; cor: string; rotulo: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 text-gray-500">{rotulo}</span>
      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${cor}`} style={{ width: `${maximo > 0 ? (valor / maximo) * 100 : 0}%` }} />
      </div>
      <span className="w-12 text-right text-gray-700 font-medium">{fmt(valor)}</span>
    </div>
  )
}

export default function ComparacaoPage() {
  const [semanas, setSemanas] = useState<SemanaComparacao[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    fetch('/api/planejamento/comparacao?limite=12')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { setSemanas(d); setCarregando(false) })
  }, [])

  const ind = indicadores(semanas)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900">Planejado x realizado</h1>
          <p className="text-sm text-gray-500 mt-1">Previsão e plano de cada semana comparados com a produção concluída e as vendas</p>
        </div>
        <Link href="/planejamento" className="text-sm text-gray-500 hover:text-gray-700 underline">Voltar ao planejamento</Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-[#e7e1cf] rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Erro médio da previsão</p>
          <p className="font-display text-3xl font-bold text-brand-900">{ind.erroMedio === null ? '—' : `${fmt(ind.erroMedio)} un.`}</p>
          <p className="text-xs text-gray-400 mt-1">por sabor e semana encerrada ({ind.semanas})</p>
        </div>
        <div className="bg-white border border-[#e7e1cf] rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Vendas dentro da faixa prevista</p>
          <p className="font-display text-3xl font-bold text-brand-900">{pct(ind.dentroDoIntervalo)}</p>
          <p className="text-xs text-gray-400 mt-1">o esperado é em torno de 80%</p>
        </div>
        <div className="bg-white border border-[#e7e1cf] rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Produção / planejado</p>
          <p className="font-display text-3xl font-bold text-brand-900">{pct(ind.aderencia)}</p>
          <p className="text-xs text-gray-400 mt-1">ordens concluídas na semana</p>
        </div>
      </div>

      {carregando ? (
        <p className="text-gray-500 text-sm">Carregando...</p>
      ) : semanas.length === 0 ? (
        <div className="text-center py-10 text-gray-400 bg-white border border-[#e7e1cf] rounded-2xl">
          <p>Nenhum plano salvo ainda.</p>
          <Link href="/planejamento" className="text-sm text-brand-600 hover:underline">Criar o primeiro plano</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {semanas.map((s) => {
            const totais = {
              previsao: soma(s.linhas, 'previsao'),
              planejado: soma(s.linhas, 'planejado'),
              produzido: soma(s.linhas, 'produzido'),
              vendido: soma(s.linhas, 'vendido'),
            }
            const maximo = Math.max(totais.previsao, totais.planejado, totais.produzido, totais.vendido)
            const sit = SITUACAO[s.situacao]
            return (
              <div key={s.semana} className="bg-white border border-[#e7e1cf] rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4 items-start">
                  <div className="min-w-[10rem]">
                    <p className="font-semibold text-gray-900">{formatarSemana(s.semana)}</p>
                    <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-xs font-semibold ${sit.classe}`}>{sit.texto}</span>
                  </div>
                  <div className="flex-1 min-w-[14rem] space-y-1.5">
                    <Barra rotulo="Previsto" valor={totais.previsao} maximo={maximo} cor="bg-gray-400" />
                    <Barra rotulo="Planejado" valor={totais.planejado} maximo={maximo} cor="bg-brand-500" />
                    <Barra rotulo="Produzido" valor={totais.produzido} maximo={maximo} cor="bg-brand-700" />
                    <Barra rotulo="Vendido" valor={totais.vendido} maximo={maximo} cor="bg-amber-500" />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Sabor</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Previsto</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Planejado</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Produzido</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendido</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Venda − previsão</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {s.linhas.map((l) => {
                        const fora = l.limiteInferior !== null && l.limiteSuperior !== null && s.situacao === 'encerrada'
                          && (l.vendido < l.limiteInferior || l.vendido > l.limiteSuperior)
                        const diferenca = l.previsao === null || s.situacao === 'futura' ? null : l.vendido - l.previsao
                        return (
                          <tr key={l.receitaId}>
                            <td className="px-4 py-2 text-sm text-gray-900 font-medium">{l.nome}</td>
                            <td className="px-4 py-2 text-sm text-right text-gray-700 whitespace-nowrap">
                              {fmt(l.previsao)}
                              {l.limiteInferior !== null && l.limiteSuperior !== null && (
                                <span className="block text-xs text-gray-400">{fmt(l.limiteInferior)} a {fmt(l.limiteSuperior)}</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-sm text-right text-gray-900">{fmt(l.planejado, 3)}</td>
                            <td className={`px-4 py-2 text-sm text-right ${l.produzido < l.planejado && s.situacao === 'encerrada' ? 'text-red-600' : 'text-gray-900'}`}>{fmt(l.produzido, 3)}</td>
                            <td className="px-4 py-2 text-sm text-right text-gray-900">{fmt(l.vendido, 3)}</td>
                            <td className={`px-4 py-2 text-sm text-right ${fora ? 'text-red-600 font-semibold' : 'text-gray-700'}`} title={fora ? 'Fora da faixa prevista' : undefined}>
                              {diferenca === null ? '—' : `${diferenca > 0 ? '+' : ''}${fmt(diferenca)}`}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
