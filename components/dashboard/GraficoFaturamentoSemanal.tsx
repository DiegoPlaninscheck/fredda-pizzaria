'use client'

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export interface PontoSemana {
  semana: string
  rotulo: string
  valor: number
}

const moeda = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const compacto = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k` : String(v))

/** Barras do faturamento por semana; a semana atual (em andamento) fica destacada. */
export default function GraficoFaturamentoSemanal({ dados }: { dados: PontoSemana[] }) {
  return (
    <div className="h-64" role="img" aria-label={`Faturamento das últimas ${dados.length} semanas`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#efeadb" />
          <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#5a6a61' }} />
          <YAxis tickFormatter={compacto} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#5a6a61' }} width={44} />
          <Tooltip
            cursor={{ fill: '#f6f0de' }}
            formatter={(v: number) => [moeda(v), 'Faturamento']}
            labelFormatter={(rotulo: string) => `Semana de ${rotulo}`}
            contentStyle={{ borderRadius: 12, border: '1px solid #e7e1cf', fontSize: 13 }}
          />
          <Bar dataKey="valor" radius={[6, 6, 0, 0]} maxBarSize={44}>
            {dados.map((p, i) => (
              <Cell key={p.semana} fill={i === dados.length - 1 ? '#0f231a' : '#3d8563'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
