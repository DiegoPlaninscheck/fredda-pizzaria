import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NovaOrdemPage from '@/app/(dashboard)/producao/nova/page'
import { erro, roteador, simularApi } from '../helpers/next'

const farinha = { id: 'f', nome: 'Farinha 00', unidade: 'KG', estoqueAtual: '4' }
const receitas = [
  { id: 'm', nome: 'Margherita', descricao: null, rendimento: '1', insumos: [{ id: 'ri1', quantidade: '0.3', insumo: farinha }] },
  { id: 'c', nome: 'Calabrese', descricao: null, rendimento: '1', insumos: [{ id: 'ri2', quantidade: '0.3', insumo: farinha }] },
]

async function marcar(nome: string, quantidade: string) {
  await userEvent.click(screen.getByRole('checkbox', { name: nome }))
  const caixa = screen.getByRole('checkbox', { name: nome }).closest('div')!
  const campo = within(caixa).getByPlaceholderText('Ex: 20')
  await userEvent.clear(campo)
  await userEvent.type(campo, quantidade)
}

const linhaInsumo = (receita: string) =>
  within(screen.getByText(receita, { selector: 'p' }).parentElement!).getByText('Farinha 00').parentElement!

describe('nova ordem de produção', () => {
  it('cria a ordem com as receitas marcadas e abre o detalhe', async () => {
    const chamadas = simularApi({ '/api/receitas': receitas, 'POST /api/ordens': { id: 'o1', insuficientes: [] } })
    render(<NovaOrdemPage />)
    await screen.findByText('Margherita')
    await marcar('Margherita', '10')
    await userEvent.type(screen.getByPlaceholderText('Observações opcionais'), 'lote de sábado')
    await userEvent.click(screen.getByRole('button', { name: 'Criar Ordem' }))

    expect(chamadas.find((c) => c.metodo === 'POST')!.corpo).toEqual({ receitas: [{ receitaId: 'm', quantidade: 10 }], dataPrevista: null, observacoes: 'lote de sábado' })
    expect(roteador.push).toHaveBeenCalledWith('/producao/o1')
  })

  it('mostra o consumo de cada insumo e marca em verde quando o estoque dá conta', async () => {
    simularApi({ '/api/receitas': receitas })
    render(<NovaOrdemPage />)
    await screen.findByText('Margherita')
    await marcar('Margherita', '10')
    const linha = linhaInsumo('Margherita')
    expect(linha).toHaveTextContent('3 KG')
    expect(linha).toHaveTextContent('(est. 4)')
    expect(linha).toHaveClass('bg-green-50')
  })

  it('soma o consumo das receitas que usam o mesmo insumo: 3 kg + 3 kg não cabem em 4 kg', async () => {
    simularApi({ '/api/receitas': receitas })
    render(<NovaOrdemPage />)
    await screen.findByText('Margherita')
    await marcar('Margherita', '10')
    await marcar('Calabrese', '10')
    expect(linhaInsumo('Margherita')).toHaveClass('bg-red-50')
    expect(linhaInsumo('Calabrese')).toHaveClass('bg-red-50')
  })

  it('ordem criada com falta de insumo mostra o aviso do servidor e o link para a ordem', async () => {
    simularApi({
      '/api/receitas': receitas,
      'POST /api/ordens': { id: 'o2', insuficientes: [{ receita: 'Margherita, Calabrese', nome: 'Farinha 00', necessario: '6.000', disponivel: '4.000' }] },
    })
    render(<NovaOrdemPage />)
    await screen.findByText('Margherita')
    await marcar('Margherita', '10')
    await marcar('Calabrese', '10')
    await userEvent.click(screen.getByRole('button', { name: 'Criar Ordem' }))

    expect(await screen.findByText(/Ordem criada, mas há estoque insuficiente/)).toBeInTheDocument()
    expect(screen.getByText(/\[Margherita, Calabrese\] Farinha 00: necessário 6/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Ver ordem criada/ }))
    expect(roteador.push).toHaveBeenCalledWith('/producao/o2')
  })

  it('valida antes de enviar e mostra o erro da API', async () => {
    simularApi({ '/api/receitas': receitas, 'POST /api/ordens': erro(400, 'Quantidade deve ser maior que zero') })
    render(<NovaOrdemPage />)
    await screen.findByText('Margherita')
    await userEvent.click(screen.getByRole('button', { name: 'Criar Ordem' }))
    expect(screen.getByText('Selecione ao menos uma receita')).toBeInTheDocument()

    await marcar('Margherita', '5')
    await userEvent.click(screen.getByRole('button', { name: 'Criar Ordem' }))
    expect(await screen.findByText('Quantidade deve ser maior que zero')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(roteador.back).toHaveBeenCalled()
  })
})
