import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardTitulo } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { ConfirmProvider, useConfirm, type OpcoesConfirmacao } from '@/components/ui/ConfirmDialog'
import { ToastProvider, useToast } from '@/components/ui/Toast'

describe('Button', () => {
  it('é do tipo "button" por padrão (não envia formulários sem querer) e repassa o clique', async () => {
    const clique = vi.fn()
    render(<Button onClick={clique}>Salvar</Button>)
    const botao = screen.getByRole('button', { name: 'Salvar' })
    expect(botao).toHaveAttribute('type', 'button')
    await userEvent.click(botao)
    expect(clique).toHaveBeenCalledOnce()
  })

  it('carregando: desabilita, marca aria-busy e troca o texto', async () => {
    const clique = vi.fn()
    render(<Button carregando textoCarregando="Salvando..." onClick={clique}>Salvar</Button>)
    const botao = screen.getByRole('button', { name: 'Salvando...' })
    expect(botao).toBeDisabled()
    expect(botao).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(botao)
    expect(clique).not.toHaveBeenCalled()
  })

  it('aplica a variante de perigo e classes extras', () => {
    render(<Button variante="perigoSolido" tamanho="sm" className="w-full">Excluir</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-red-700', 'text-sm', 'w-full')
  })
})

describe('componentes de layout', () => {
  it('Badge, Card, CardTitulo e PageHeader renderizam conteúdo e ações', () => {
    render(
      <>
        <PageHeader titulo="Pedidos" subtitulo="Pedidos do WhatsApp" acoes={<button>Novo</button>} />
        <Card data-testid="card"><CardTitulo acao={<a href="#">ver</a>}>Itens</CardTitulo></Card>
        <Badge className="bg-amber-100">Pendente</Badge>
      </>
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Pedidos' })).toBeInTheDocument()
    expect(screen.getByText('Pedidos do WhatsApp')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Novo' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Itens' })).toBeInTheDocument()
    expect(screen.getByText('Pendente')).toHaveClass('rounded-full', 'bg-amber-100')
    expect(screen.getByTestId('card')).toHaveClass('rounded-2xl')
  })
})

/** Componente de teste que pede uma confirmação e mostra o resultado. */
function PedeConfirmacao({ opcoes }: { opcoes: OpcoesConfirmacao }) {
  const confirmar = useConfirm()
  return (
    <>
      <button onClick={async () => { document.title = String(await confirmar(opcoes)) }}>Abrir</button>
      <input aria-label="fora" />
    </>
  )
}

describe('ConfirmDialog (substitui o window.confirm)', () => {
  const abrir = async (opcoes: OpcoesConfirmacao) => {
    render(<ConfirmProvider><PedeConfirmacao opcoes={opcoes} /></ConfirmProvider>)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    return screen.getByRole('dialog')
  }

  it('confirmar resolve true e fecha o diálogo', async () => {
    const dialogo = await abrir({ titulo: 'Confirmar pedido #12?', descricao: 'Gera as vendas.', itens: ['As vendas são registradas'], confirmar: 'Confirmar pedido' })
    expect(dialogo).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('As vendas são registradas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar pedido' })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }))
    await waitFor(() => expect(document.title).toBe('true'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('ação perigosa começa com o foco em "Voltar"; Esc cancela (false)', async () => {
    await abrir({ titulo: 'Cancelar pedido?', perigo: true })
    expect(screen.getByRole('button', { name: 'Voltar' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Confirmar' })).toHaveClass('bg-red-700')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(document.title).toBe('false'))
  })

  it('mantém o foco dentro do diálogo com Tab e Shift+Tab', async () => {
    await abrir({ titulo: 'Teste' })
    const [voltar, confirmar] = [screen.getByRole('button', { name: 'Voltar' }), screen.getByRole('button', { name: 'Confirmar' })]
    expect(confirmar).toHaveFocus()
    await userEvent.tab()
    expect(voltar).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(confirmar).toHaveFocus()
  })

  it('clicar fora (no fundo) cancela', async () => {
    const dialogo = await abrir({ titulo: 'Teste', cancelar: 'Não' })
    await userEvent.pointer({ keys: '[MouseLeft]', target: dialogo.parentElement! })
    await waitFor(() => expect(document.title).toBe('false'))
  })

  it('usar fora do provider é um erro de programação explícito', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<PedeConfirmacao opcoes={{ titulo: 'x' }} />)).toThrow('useConfirm precisa estar dentro de <ConfirmProvider>')
    expect(() => render(<MostraAvisos />)).toThrow('useToast precisa estar dentro de <ToastProvider>')
  })
})

function MostraAvisos() {
  const toast = useToast()
  return (
    <>
      <button onClick={() => toast.sucesso('Pedido confirmado', 'Cliente avisado')}>sucesso</button>
      <button onClick={() => toast.erro('Falhou')}>erro</button>
      <button onClick={() => toast.alerta('Atenção')}>alerta</button>
      <button onClick={() => toast.info('Informação')}>info</button>
    </>
  )
}

describe('Toast (avisos)', () => {
  it('mostra sucesso como status e erro como alert, e fecha pelo botão', async () => {
    render(<ToastProvider><MostraAvisos /></ToastProvider>)
    await userEvent.click(screen.getByRole('button', { name: 'sucesso' }))
    await userEvent.click(screen.getByRole('button', { name: 'erro' }))
    expect(screen.getByRole('status')).toHaveTextContent('Pedido confirmadoCliente avisado')
    expect(screen.getByRole('alert')).toHaveTextContent('Falhou')
    await userEvent.click(screen.getAllByRole('button', { name: 'Fechar aviso' })[0])
    expect(screen.queryByText('Pedido confirmado')).not.toBeInTheDocument()
  })

  it('some sozinho: sucesso em 5 s, erro e alerta ficam 9 s', () => {
    vi.useFakeTimers()
    render(<ToastProvider><MostraAvisos /></ToastProvider>)
    act(() => {
      screen.getByRole('button', { name: 'info' }).click()
      screen.getByRole('button', { name: 'alerta' }).click()
    })
    act(() => { vi.advanceTimersByTime(5100) })
    expect(screen.queryByText('Informação')).not.toBeInTheDocument()
    expect(screen.getByText('Atenção')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(4000) })
    expect(screen.queryByText('Atenção')).not.toBeInTheDocument()
  })

  it('mostra no máximo 4 avisos ao mesmo tempo', () => {
    render(<ToastProvider><MostraAvisos /></ToastProvider>)
    act(() => { for (let i = 0; i < 6; i++) screen.getByRole('button', { name: 'info' }).click() })
    expect(screen.getAllByText('Informação')).toHaveLength(4)
  })
})
