import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PlanejamentoPage from '@/app/(dashboard)/planejamento/page'
import { erro, logarComo, simularApi } from '../helpers/next'
import { renderPainel } from '../helpers/render'

const item = (nome: string, extra: object) => ({
  receitaId: `r-${nome}`, nome, estoqueAtual: 4, emProducao: 6, demandaAteLa: 3, estoqueProjetado: 7,
  previsao: 20, limiteInferior: 14, limiteSuperior: 27, metodo: 'hist_gradient_boosting_poisson', sugerido: 13, sugeridoSeguro: 20,
  ...extra,
})

const sugestao = (extra: object = {}) => ({
  semana: '2026-11-30', iaDisponivel: true, aviso: null, modeloAtivo: 'hist_gradient_boosting_poisson',
  nivelConfianca: 0.8, treinadoEm: '2026-11-20T10:00:00Z',
  itens: [item('Calabrese', { sugerido: 4, sugeridoSeguro: 7, previsao: 8.4, limiteInferior: 5, limiteSuperior: 11.2 }), item('Margherita', {})],
  ...extra,
})

const linha = (nome: string) => screen.getByText(nome).closest('tr')!
const campoPlanejado = (nome: string) => within(linha(nome)).getByRole('spinbutton') as HTMLInputElement

describe('tela de planejamento de produção', () => {
  it('mostra a sugestão da próxima semana com estoque projetado, previsão e faixa de 80%', async () => {
    simularApi({ '/api/planejamento/sugestao': sugestao(), '/api/planejamento': null })
    renderPainel(<PlanejamentoPage />)

    expect(await screen.findByText('Margherita')).toBeInTheDocument()
    expect(within(linha('Margherita')).getByText('4 em estoque + 6 em produção − 3 até lá')).toBeInTheDocument()
    expect(within(linha('Margherita')).getByText('14 a 27')).toBeInTheDocument()
    expect(within(linha('Calabrese')).getByText('8,4')).toBeInTheDocument()
    expect(campoPlanejado('Margherita').value).toBe('13')
    expect(screen.getByText('Modelo:').textContent).toBe('Modelo: Modelo de IA')
    expect(within(linha('Margherita')).getByText('Modelo de IA')).toBeInTheDocument() // método usado no sabor
    expect(screen.getByText(/intervalo de 80%/)).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /\(próxima\)/ })).toBeInTheDocument()
  })

  it('"Limite superior" troca a sugestão para a ponta de cima da faixa', async () => {
    simularApi({ '/api/planejamento/sugestao': sugestao(), '/api/planejamento': null })
    renderPainel(<PlanejamentoPage />)
    await screen.findByText('Margherita')

    await userEvent.click(screen.getByRole('button', { name: 'Limite superior' }))
    expect(campoPlanejado('Margherita').value).toBe('20')
    expect(campoPlanejado('Calabrese').value).toBe('7')
    expect(screen.getByText('27')).toBeInTheDocument() // total planejado
  })

  it('salvar envia o plano ajustado; só depois de salvo dá para criar a ordem', async () => {
    const chamadas = simularApi({
      '/api/planejamento/sugestao': sugestao(),
      'GET /api/planejamento': null,
      'PUT /api/planejamento': (corpo: { itens: { receitaId: string; planejado: number }[] }) => ({
        id: 'p1', updatedAt: '2026-11-23T20:00:00Z', modeloAtivo: 'x', usuario: { nome: 'Diego' }, itens: corpo.itens.map((i) => ({ receitaId: i.receitaId, planejado: String(i.planejado) })),
      }),
      'POST /api/ordens': { id: 'ordem-1', insuficientes: [] },
    })
    renderPainel(<PlanejamentoPage />)
    await screen.findByText('Margherita')
    const criarOrdem = screen.getByRole('button', { name: 'Criar ordem de produção' })
    expect(criarOrdem).toBeDisabled()

    await userEvent.clear(campoPlanejado('Margherita'))
    await userEvent.type(campoPlanejado('Margherita'), '15')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar plano' }))

    expect(await screen.findByText('Plano salvo.')).toBeInTheDocument()
    const put = chamadas.find((c) => c.metodo === 'PUT')!
    expect(put.corpo.itens.find((i: { receitaId: string }) => i.receitaId === 'r-Margherita')).toMatchObject({ planejado: 15, sugerido: 13, estoqueInicial: 7, previsao: 20 })
    expect(screen.getByText(/Plano salvo em .* por Diego/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Criar ordem de produção' }))
    expect(await screen.findByText('Ordem de produção criada.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver ordem' })).toHaveAttribute('href', '/producao/ordem-1')
    expect(chamadas.find((c) => c.url === '/api/ordens')!.corpo.receitas).toEqual([
      { receitaId: 'r-Calabrese', quantidade: 4 }, { receitaId: 'r-Margherita', quantidade: 15 },
    ])
  })

  it('quantidade inválida não é enviada', async () => {
    const chamadas = simularApi({ '/api/planejamento/sugestao': sugestao(), '/api/planejamento': null })
    renderPainel(<PlanejamentoPage />)
    await screen.findByText('Margherita')
    await userEvent.clear(campoPlanejado('Margherita'))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar plano' }))
    expect(screen.getByText('Quantidade inválida para "Margherita"')).toBeInTheDocument()
    expect(chamadas.some((c) => c.metodo === 'PUT')).toBe(false)
  })

  it('serviço de IA fora do ar: mostra o aviso e desabilita as opções de cobertura', async () => {
    simularApi({
      '/api/planejamento/sugestao': sugestao({ iaDisponivel: false, aviso: 'O microsserviço de previsão não respondeu. Preencha as quantidades manualmente.', modeloAtivo: null, nivelConfianca: null, itens: [item('Margherita', { previsao: null, limiteInferior: null, limiteSuperior: null, metodo: null, sugerido: 0, sugeridoSeguro: 0 })] }),
      '/api/planejamento': null,
    })
    renderPainel(<PlanejamentoPage />)
    expect(await screen.findByText(/não respondeu. Preencha as quantidades manualmente/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previsão' })).toBeDisabled()
    expect(screen.getByText('sem histórico')).toBeInTheDocument()
  })

  it('erro ao gerar a sugestão aparece na tela', async () => {
    simularApi({ '/api/planejamento/sugestao': erro(400, 'Semana inválida'), '/api/planejamento': null })
    renderPainel(<PlanejamentoPage />)
    expect(await screen.findByText('Semana inválida')).toBeInTheDocument()
  })

  it('ADMIN retreina o modelo depois de confirmar; OPERADOR não vê o botão', async () => {
    logarComo('ADMIN')
    const chamadas = simularApi({ '/api/planejamento/sugestao': sugestao(), '/api/planejamento': null, 'POST /api/planejamento/modelo': { modelo_ativo: 'baseline_media_movel_4' } })
    const { unmount } = renderPainel(<PlanejamentoPage />)
    await screen.findByText('Margherita')

    await userEvent.click(screen.getByRole('button', { name: 'Retreinar modelo' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Retreinar' }))
    expect(await screen.findByText('Modelo retreinado: Média das últimas 4 semanas.')).toBeInTheDocument()
    expect(chamadas.some((c) => c.url === '/api/planejamento/modelo' && c.metodo === 'POST')).toBe(true)
    unmount()

    logarComo('OPERADOR')
    simularApi({ '/api/planejamento/sugestao': sugestao(), '/api/planejamento': null })
    renderPainel(<PlanejamentoPage />)
    await screen.findByText('Margherita')
    expect(screen.queryByRole('button', { name: 'Retreinar modelo' })).not.toBeInTheDocument()
  })

  it('troca de semana recarrega a sugestão', async () => {
    const chamadas = simularApi({ '/api/planejamento/sugestao': sugestao(), '/api/planejamento': null })
    renderPainel(<PlanejamentoPage />)
    await screen.findByText('Margherita')
    const opcoes = screen.getAllByRole('option') as HTMLOptionElement[]
    await userEvent.selectOptions(screen.getByRole('combobox'), opcoes[2].value)
    await waitFor(() => expect(chamadas.filter((c) => c.url.startsWith('/api/planejamento/sugestao'))).toHaveLength(2))
    expect(chamadas.at(-2)!.url).toBe(`/api/planejamento/sugestao?semana=${opcoes[2].value}`)
  })
})
