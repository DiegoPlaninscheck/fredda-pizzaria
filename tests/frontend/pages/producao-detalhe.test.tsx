import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OrdemDetalhe from '@/app/(dashboard)/producao/[id]/page'
import { erro, navegacao, roteador, simularApi } from '../helpers/next'
import { renderPainel } from '../helpers/render'

const etapa = (ordem: number, nome: string, extra: object = {}) => ({
  id: `e${ordem}`, nome, ordem, status: 'PENDENTE', duracaoMinutos: 60, minutosDecorridos: 0, iniciadaEm: null, concluidaEm: null, registros: [],
  ...extra,
})

const ordem = (extra: object = {}) => ({
  id: 'o1', status: 'EM_ANDAMENTO', dataPrevista: '2026-11-28T00:00:00Z', observacoes: 'lote de sábado', createdAt: '2026-11-23T12:00:00Z',
  usuario: { nome: 'Diego' },
  receitas: [{ id: 'or1', quantidade: '10', receita: { nome: 'Margherita', descricao: null, insumos: [{ id: 'ri1', quantidade: '0.25', insumo: { nome: 'Farinha 00', unidade: 'KG' } }] } }],
  etapas: [
    etapa(1, 'MISTURA', { status: 'CONCLUIDA', minutosDecorridos: 30, duracaoMinutos: 30, registros: [{ id: 'r1', temperatura: '24.5', umidade: '60', observacoes: 'massa lisa', createdAt: '2026-11-23T12:20:00Z' }] }),
    etapa(2, 'DESCANSO_INICIAL', { status: 'EM_ANDAMENTO', minutosDecorridos: 10, iniciadaEm: new Date(Date.now() - 50 * 60000).toISOString() }),
    etapa(3, 'FERMENTACAO_LONGA', { duracaoMinutos: 1440 }),
  ],
  ...extra,
})

const cartao = (nome: string) => screen.getByText(nome).closest('div.border') as HTMLElement
const abrir = async (nome: string) => userEvent.click(screen.getByText(nome))

describe('detalhe da ordem de produção', () => {
  it('mostra receitas, quantidades, etapas com tempo decorrido e ingredientes', async () => {
    navegacao.params = { id: 'o1' }
    simularApi({ '/api/ordens/o1': ordem() })
    renderPainel(<OrdemDetalhe />)

    expect(await screen.findByRole('heading', { name: 'Margherita' })).toBeInTheDocument()
    expect(screen.getByText(/Margherita: 10 un\. · Diego/)).toBeInTheDocument()
    expect(screen.getByText('lote de sábado')).toBeInTheDocument()
    expect(within(cartao('Mistura')).getByText('30min / 30min')).toBeInTheDocument()
    expect(within(cartao('Descanso inicial')).getByText('1h / 1h')).toBeInTheDocument() // 10 + 50 em andamento
    expect(within(cartao('Fermentação longa')).getByText('0min / 24h')).toBeInTheDocument()
    expect(screen.getByText('0,25 KG')).toBeInTheDocument()
  })

  it('etapa em andamento pode ser pausada; a ordem acompanha o status', async () => {
    navegacao.params = { id: 'o1' }
    const chamadas = simularApi({
      '/api/ordens/o1': ordem(),
      'PATCH /api/ordens/o1/etapas/e2': etapa(2, 'DESCANSO_INICIAL', { status: 'PAUSADA', minutosDecorridos: 60 }),
    })
    renderPainel(<OrdemDetalhe />)
    await screen.findByText('Descanso inicial')
    await abrir('Descanso inicial')
    await userEvent.click(within(cartao('Descanso inicial')).getByRole('button', { name: '⏸ Pausar' }))

    expect(chamadas.find((c) => c.metodo === 'PATCH')!.corpo).toEqual({ acao: 'PAUSAR' })
    await waitFor(() => expect(screen.getAllByText('Pausada')).toHaveLength(2)) // etapa e ordem
  })

  it('registra temperatura e umidade na etapa em andamento', async () => {
    navegacao.params = { id: 'o1' }
    const chamadas = simularApi({
      '/api/ordens/o1': ordem(),
      'POST /api/ordens/o1/etapas/e2/condicoes': { id: 'r2', temperatura: '4.5', umidade: '70', observacoes: null, createdAt: '2026-11-23T13:00:00Z' },
    })
    renderPainel(<OrdemDetalhe />)
    await screen.findByText('Descanso inicial')
    await abrir('Descanso inicial')
    const c = cartao('Descanso inicial')
    expect(within(c).getByRole('button', { name: 'Salvar registro' })).toBeDisabled()
    await userEvent.type(within(c).getByPlaceholderText('Ex: 22.5'), '4.5')
    await userEvent.type(within(c).getByPlaceholderText('Ex: 65'), '70')
    await userEvent.click(within(c).getByRole('button', { name: 'Salvar registro' }))

    expect(chamadas.find((x) => x.metodo === 'POST')!.corpo).toEqual({ temperatura: '4.5', umidade: '70' })
    expect(await within(c).findByText('4.5°C')).toBeInTheDocument()
    expect(within(c).getByText('70% UR')).toBeInTheDocument()
  })

  it('mostra os registros de uma etapa concluída e o erro de uma ação recusada', async () => {
    navegacao.params = { id: 'o1' }
    simularApi({ '/api/ordens/o1': ordem(), 'PATCH /api/ordens/o1/etapas/e3': erro(409, 'Outra etapa já está em andamento nesta ordem') })
    renderPainel(<OrdemDetalhe />)
    await screen.findByText('Mistura')
    await abrir('Mistura')
    expect(within(cartao('Mistura')).getByText('massa lisa')).toBeInTheDocument()
    expect(within(cartao('Mistura')).getByText('Registros (1)')).toBeInTheDocument()

    await abrir('Fermentação longa')
    await userEvent.click(within(cartao('Fermentação longa')).getByRole('button', { name: '▶ Iniciar' }))
    expect(await screen.findByText('Outra etapa já está em andamento nesta ordem')).toBeInTheDocument()
  })

  it('concluir a última etapa pendente conclui a ordem', async () => {
    navegacao.params = { id: 'o1' }
    simularApi({
      '/api/ordens/o1': ordem({ etapas: [etapa(1, 'MISTURA', { status: 'CONCLUIDA' }), etapa(2, 'CONGELAMENTO', { status: 'EM_ANDAMENTO', iniciadaEm: new Date().toISOString() })] }),
      'PATCH /api/ordens/o1/etapas/e2': etapa(2, 'CONGELAMENTO', { status: 'CONCLUIDA' }),
    })
    renderPainel(<OrdemDetalhe />)
    await screen.findByText('Congelamento')
    await abrir('Congelamento')
    await userEvent.click(within(cartao('Congelamento')).getByRole('button', { name: '✓ Concluir' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cancelar ordem' })).not.toBeInTheDocument())
    expect(screen.getAllByText('Concluída').length).toBeGreaterThanOrEqual(3)
  })

  it('cancelar pede confirmação e avisa o resultado', async () => {
    navegacao.params = { id: 'o1' }
    const chamadas = simularApi({ '/api/ordens/o1': ordem(), 'PATCH /api/ordens/o1': { id: 'o1', status: 'CANCELADA' } })
    renderPainel(<OrdemDetalhe />)
    await screen.findByText('Mistura')

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar ordem' }))
    const dialogo = screen.getByRole('dialog')
    expect(within(dialogo).getByText('A ordem é encerrada e não pode ser retomada.')).toBeInTheDocument()
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar ordem' }))

    expect(await screen.findByText('Ordem de produção cancelada')).toBeInTheDocument()
    expect(chamadas.find((c) => c.metodo === 'PATCH' && c.url === '/api/ordens/o1')!.corpo).toEqual({ status: 'CANCELADA' })
  })

  it('ordem inexistente mostra o aviso; voltar leva à lista', async () => {
    navegacao.params = { id: 'x' }
    simularApi({ '/api/ordens/x': erro(404, 'Não encontrado') })
    renderPainel(<OrdemDetalhe />)
    expect(await screen.findByText('Ordem não encontrada')).toBeInTheDocument()

    navegacao.params = { id: 'o1' }
    simularApi({ '/api/ordens/o1': ordem() })
    renderPainel(<OrdemDetalhe />)
    await userEvent.click(await screen.findByRole('button', { name: '← Produção' }))
    expect(roteador.push).toHaveBeenCalledWith('/producao')
  })
})
