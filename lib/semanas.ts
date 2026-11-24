/**
 * Semanas de planejamento: segunda a domingo, no horário da pizzaria.
 * O Brasil não tem horário de verão desde 2019, então o fuso é fixo em UTC−3.
 * Uma semana é identificada pela data da segunda-feira ('YYYY-MM-DD').
 */
const FUSO_HORAS = 3
const DIA_MS = 24 * 60 * 60 * 1000

function paraIso(d: Date) {
  return d.toISOString().slice(0, 10)
}

/** Segunda-feira da semana que contém `data` (no horário local da pizzaria). */
export function segundaDaSemana(data: Date = new Date()): string {
  const local = new Date(data.getTime() - FUSO_HORAS * 60 * 60 * 1000)
  const diasDesdeSegunda = (local.getUTCDay() + 6) % 7
  return paraIso(new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - diasDesdeSegunda)))
}

export function adicionarSemanas(semana: string, n: number): string {
  return paraIso(new Date(Date.parse(`${semana}T00:00:00Z`) + n * 7 * DIA_MS))
}

export function adicionarDias(semana: string, n: number): string {
  return paraIso(new Date(Date.parse(`${semana}T00:00:00Z`) + n * DIA_MS))
}

/** Número de semanas de `de` até `ate` (ambas segundas-feiras). */
export function semanasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / (7 * DIA_MS))
}

/** Valida 'YYYY-MM-DD' e exige que seja uma segunda-feira. */
export function validarSemana(valor: string | null | undefined): string | null {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null
  const d = new Date(`${valor}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || paraIso(d) !== valor || d.getUTCDay() !== 1) return null
  return valor
}

/** Valor para colunas @db.Date (meia-noite UTC da segunda-feira). */
export function semanaParaData(semana: string): Date {
  return new Date(`${semana}T00:00:00Z`)
}

export function dataParaSemana(data: Date): string {
  return paraIso(data)
}

/** Início e fim (exclusivo) da semana em UTC, para filtrar vendas e ordens. */
export function intervaloUtc(semana: string): { inicio: Date; fim: Date } {
  const inicio = new Date(Date.parse(`${semana}T00:00:00Z`) + FUSO_HORAS * 60 * 60 * 1000)
  return { inicio, fim: new Date(inicio.getTime() + 7 * DIA_MS) }
}

/**
 * Início (00:00) e fim (23:59:59.999) de um dia 'YYYY-MM-DD' no horário da pizzaria,
 * para filtros por período. `new Date('YYYY-MM-DD')` seria meia-noite em UTC (21h da
 * véspera em Brasília) e deixaria de fora as vendas da noite do último dia.
 */
export function inicioDoDia(dia: string): Date {
  return new Date(Date.parse(`${dia}T00:00:00Z`) + FUSO_HORAS * 60 * 60 * 1000)
}

export function fimDoDia(dia: string): Date {
  return new Date(inicioDoDia(dia).getTime() + DIA_MS - 1)
}

export function formatarSemana(semana: string): string {
  const [a, m, d] = semana.split('-')
  const [a2, m2, d2] = adicionarDias(semana, 6).split('-')
  return a === a2 ? `${d}/${m} a ${d2}/${m2}/${a}` : `${d}/${m}/${a} a ${d2}/${m2}/${a2}`
}
