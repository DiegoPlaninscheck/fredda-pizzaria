import { describe, expect, it } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Sidebar, { EVENTO_CONTADORES } from '@/components/Sidebar'
import Transcricao from '@/components/Transcricao'
import GraficoFaturamentoSemanal from '@/components/dashboard/GraficoFaturamentoSemanal'
import { autenticacao, logarComo, navegacao, simularApi } from '../helpers/next'

describe('Sidebar (navegação do painel)', () => {
  it('mostra os contadores de pedidos aguardando e de insumos em alerta', async () => {
    simularApi({ '/api/insumos': [{ id: 'a' }, { id: 'b' }], '/api/pedidos/resumo': { pendentes: 3, conversasAguardando: 1 } })
    render(<Sidebar />)
    expect(await screen.findByText('4')).toBeInTheDocument() // pedidos: 3 pendentes + 1 conversa
    expect(screen.getByRole('link', { name: /Estoque/ })).toHaveTextContent('2')
  })

  it('destaca a página atual (inclusive subpáginas) e mostra o usuário logado', async () => {
    navegacao.caminho = '/pedidos/42'
    logarComo('OPERADOR')
    simularApi({ '/api/insumos': [], '/api/pedidos/resumo': { pendentes: 0, conversasAguardando: 0 } })
    render(<Sidebar />)
    expect(screen.getByRole('link', { name: /Pedidos/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /Dashboard/ })).not.toHaveAttribute('aria-current')
    expect(screen.getByText('DP')).toBeInTheDocument()
    expect(screen.getByText('Operador')).toBeInTheDocument()
  })

  it('atualiza os contadores quando uma tela avisa (evento) e mostra 99+ acima de 99', async () => {
    let pendentes = 0
    simularApi({ '/api/insumos': [], '/api/pedidos/resumo': () => ({ pendentes, conversasAguardando: 0 }) })
    render(<Sidebar />)
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    pendentes = 150
    act(() => { window.dispatchEvent(new Event(EVENTO_CONTADORES)) })
    expect(await screen.findByText('99+')).toBeInTheDocument()
  })

  it('abre e fecha o menu no celular e sai da conta', async () => {
    logarComo('ADMIN')
    simularApi({ '/api/insumos': [], '/api/pedidos/resumo': { pendentes: 0, conversasAguardando: 0 } })
    render(<Sidebar />)
    expect(screen.getByText('Administrador')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Abrir menu' }))
    expect(screen.getByRole('button', { name: 'Fechar menu' })).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Fechar menu' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sair' }))
    expect(autenticacao.signOut).toHaveBeenCalledWith({ callbackUrl: '/login' })
  })
})

describe('Transcricao (conversa do WhatsApp em balões)', () => {
  it('mostra cliente e Fredda em lados opostos e separa as opções dos botões', () => {
    render(<Transcricao mensagens={[
      { id: '1', direcao: 'ENTRADA', texto: 'oi', createdAt: '2026-11-23T15:00:00Z' },
      { id: '2', direcao: 'SAIDA', texto: 'Como posso ajudar?\n[🍕 Fazer pedido | 📦 Meus pedidos]', createdAt: '2026-11-23T15:00:05Z' },
    ]} />)
    expect(screen.getByText('oi').parentElement).toHaveClass('justify-start')
    expect(screen.getByText('Como posso ajudar?').parentElement).toHaveClass('justify-end')
    expect(screen.getByText('🍕 Fazer pedido')).toBeInTheDocument()
    expect(screen.getByText('📦 Meus pedidos')).toBeInTheDocument()
  })

  it('sem mensagens avisa', () => {
    render(<Transcricao mensagens={[]} />)
    expect(screen.getByText('Nenhuma mensagem registrada.')).toBeInTheDocument()
  })
})

describe('GraficoFaturamentoSemanal', () => {
  it('descreve o gráfico para leitores de tela', () => {
    render(<GraficoFaturamentoSemanal dados={[
      { semana: '2026-11-09', rotulo: '09/11', valor: 1200 },
      { semana: '2026-11-16', rotulo: '16/11', valor: 980.5 },
    ]} />)
    expect(screen.getByRole('img', { name: 'Faturamento das últimas 2 semanas' })).toBeInTheDocument()
  })
})
