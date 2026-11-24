import { describe, expect, it } from 'vitest'
import { LIMITES, botoes, lista, paraTranscricao, texto } from '@/lib/chatbot/mensagens'

describe('mensagens do atendimento (limites da Cloud API do WhatsApp)', () => {
  it('botões: no máximo 3, com títulos de até 20 caracteres', () => {
    const msg = botoes('Escolha', [
      { id: '1', titulo: 'Um título muito comprido demais' }, { id: '2', titulo: 'B' }, { id: '3', titulo: 'C' }, { id: '4', titulo: 'D' },
    ])
    expect(msg.tipo).toBe('botoes')
    if (msg.tipo !== 'botoes') return
    expect(msg.botoes).toHaveLength(LIMITES.botoes)
    expect(msg.botoes[0].titulo).toHaveLength(20)
    expect(msg.botoes[0].titulo.endsWith('…')).toBe(true)
  })

  it('lista: no máximo 10 linhas e corpo de até 1024 caracteres', () => {
    const opcoes = Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, titulo: `Sabor ${i}`, descricao: 'x'.repeat(100) }))
    const msg = lista('y'.repeat(2000), 'Ver todos os sabores do cardápio', opcoes)
    if (msg.tipo !== 'lista') throw new Error('esperava lista')
    expect(msg.opcoes).toHaveLength(10)
    expect(msg.texto).toHaveLength(1024)
    expect(msg.botao).toHaveLength(20)
    expect(msg.opcoes[0].descricao).toHaveLength(72)
  })

  it('transcrição para o painel mostra o texto e as opções', () => {
    expect(paraTranscricao(texto('oi'))).toBe('oi')
    expect(paraTranscricao(botoes('Confirma?', [{ id: 's', titulo: 'Sim' }, { id: 'n', titulo: 'Não' }]))).toBe('Confirma?\n[Sim | Não]')
  })
})
