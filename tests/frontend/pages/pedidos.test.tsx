import { describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PedidosPage from '@/app/(dashboard)/pedidos/page'
import { simularApi } from '../helpers/next'

const pedido = (id: number, extra: object = {}) => ({
  id, status: 'PENDENTE', canal: 'WHATSAPP', tipoEntrega: 'ENTREGA', valorTotal: '84', createdAt: '2026-11-23T18:30:00Z',
  dataEntregaDesejada: '2026-11-28T12:00:00Z', cliente: { nome: 'Ana', telefone: '5547999990000' },
  itens: [{ id: 'i1', quantidade: '2', receita: { nome: 'Margherita' } }],
  ...extra,
})

describe('lista de pedidos do WhatsApp', () => {
  it('mostra os pedidos em aberto com itens, entrega, total e status', async () => {
    simularApi({
      '/api/pedidos': [pedido(12), pedido(11, { status: 'CONFIRMADO', tipoEntrega: 'RETIRADA', dataEntregaDesejada: null, cliente: { nome: null, telefone: '5547988887777' } })],
      '/api/conversas': [],
    })
    render(<PedidosPage />)

    const linha12 = (await screen.findByRole('link', { name: '#12' })).closest('tr')!
    expect(linha12).toHaveAttribute('class', expect.stringContaining('hover'))
    expect(within(linha12).getByText('2x Margherita')).toBeInTheDocument()
    expect(within(linha12).getByText('Entrega')).toBeInTheDocument()
    expect(within(linha12).getByText('R$ 84,00')).toBeInTheDocument()
    expect(within(linha12).getByText('Aguardando confirmação')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '#12' })).toHaveAttribute('href', '/pedidos/12')

    const linha11 = screen.getByRole('link', { name: '#11' }).closest('tr')!
    expect(within(linha11).getByText('Confirmado')).toBeInTheDocument()
    expect(within(linha11).getByText('Retirada')).toBeInTheDocument()
    expect(within(linha11).queryByText('Ana')).not.toBeInTheDocument() // sem nome: mostra o telefone formatado
  })

  it('destaca os clientes aguardando um atendente', async () => {
    simularApi({
      '/api/pedidos': [],
      '/api/conversas': [{ id: 'c1', ultimaMensagemEm: '2026-11-23T18:00:00Z', cliente: { nome: 'Bia', telefone: '5547' }, mensagens: [{ texto: 'quero falar com alguém', direcao: 'ENTRADA' }] }],
    })
    render(<PedidosPage />)
    expect(await screen.findByText('Clientes aguardando um atendente (1)')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Bia/ })).toHaveAttribute('href', '/pedidos/conversas/c1')
    expect(screen.getByText('Nenhum pedido encontrado')).toBeInTheDocument()
  })

  it('os filtros consultam a API pelo status escolhido', async () => {
    const chamadas = simularApi({ '/api/pedidos': [], '/api/conversas': [] })
    render(<PedidosPage />)
    await screen.findByText('Nenhum pedido encontrado')
    await userEvent.click(screen.getByRole('button', { name: 'Cancelados' }))
    await waitFor(() => expect(chamadas.some((c) => c.url === '/api/pedidos?status=CANCELADO')).toBe(true))
    await userEvent.click(screen.getByRole('button', { name: 'Todos' }))
    await waitFor(() => expect(chamadas.some((c) => c.url === '/api/pedidos?status=TODOS')).toBe(true))
  })
})
