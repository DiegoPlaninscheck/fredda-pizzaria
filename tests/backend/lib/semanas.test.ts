import { describe, expect, it } from 'vitest'
import {
  adicionarDias, adicionarSemanas, dataParaSemana, formatarSemana, intervaloUtc,
  segundaDaSemana, semanaParaData, semanasEntre, validarSemana,
} from '@/lib/semanas'

describe('semanas de planejamento (segunda a domingo, horário de Brasília)', () => {
  it('encontra a segunda-feira da semana de qualquer dia', () => {
    expect(segundaDaSemana(new Date('2026-11-25T15:00:00Z'))).toBe('2026-11-23') // quarta
    expect(segundaDaSemana(new Date('2026-11-23T12:00:00Z'))).toBe('2026-11-23') // a própria segunda
  })

  it('domingo às 23h em Brasília ainda pertence à semana que está terminando', () => {
    // 23h de domingo (29/11) em Brasília = 02h de segunda (30/11) em UTC
    expect(segundaDaSemana(new Date('2026-11-30T02:00:00Z'))).toBe('2026-11-23')
    // 00h de segunda em Brasília = 03h UTC: já é a semana nova
    expect(segundaDaSemana(new Date('2026-11-30T03:00:00Z'))).toBe('2026-11-30')
  })

  it('soma semanas e dias atravessando meses e anos', () => {
    expect(adicionarSemanas('2026-12-28', 1)).toBe('2027-01-04')
    expect(adicionarSemanas('2026-11-23', -2)).toBe('2026-11-09')
    expect(adicionarDias('2026-11-23', 6)).toBe('2026-11-29')
    expect(semanasEntre('2026-11-23', '2027-01-04')).toBe(6)
  })

  it('só aceita datas válidas que caem numa segunda-feira', () => {
    expect(validarSemana('2026-11-23')).toBe('2026-11-23')
    expect(validarSemana('2026-11-24')).toBeNull() // terça
    expect(validarSemana('2026-02-30')).toBeNull() // não existe
    expect(validarSemana('23/11/2026')).toBeNull()
    expect(validarSemana(null)).toBeNull()
  })

  it('o intervalo UTC da semana começa na segunda 00h de Brasília (03h UTC)', () => {
    const { inicio, fim } = intervaloUtc('2026-11-23')
    expect(inicio.toISOString()).toBe('2026-11-23T03:00:00.000Z')
    expect(fim.toISOString()).toBe('2026-11-30T03:00:00.000Z')
  })

  it('converte entre a segunda-feira e a coluna de data do banco', () => {
    const data = semanaParaData('2026-11-23')
    expect(data.toISOString()).toBe('2026-11-23T00:00:00.000Z')
    expect(dataParaSemana(data)).toBe('2026-11-23')
  })

  it('formata o período, mostrando o ano duas vezes só na virada de ano', () => {
    expect(formatarSemana('2026-11-23')).toBe('23/11 a 29/11/2026')
    expect(formatarSemana('2026-12-28')).toBe('28/12/2026 a 03/01/2027')
  })
})
