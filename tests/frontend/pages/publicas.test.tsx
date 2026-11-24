import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { redirect } from 'next/navigation'
import LoginPage from '@/app/(auth)/login/page'
import Home from '@/app/page'
import { autenticacao, roteador } from '../helpers/next'

// A landing é uma página server: a sessão e o banco são simulados
const { sessaoServidor, receitas } = vi.hoisted(() => ({ sessaoServidor: { atual: null as unknown }, receitas: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: async () => sessaoServidor.atual }))
vi.mock('@/lib/prisma', () => ({ prisma: { receita: { findMany: receitas } } }))

describe('login', () => {
  it('entra com e-mail e senha e vai para o dashboard', async () => {
    autenticacao.signIn.mockResolvedValue({ ok: true, error: null })
    render(<LoginPage />)
    await userEvent.type(screen.getByLabelText('Email'), 'admin@freddapizzaria.com')
    await userEvent.type(screen.getByLabelText('Senha'), 'admin123')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(autenticacao.signIn).toHaveBeenCalledWith('credentials', { email: 'admin@freddapizzaria.com', senha: 'admin123', redirect: false })
    expect(roteador.push).toHaveBeenCalledWith('/dashboard')
  })

  it('credenciais erradas mostram a mensagem e não navegam', async () => {
    autenticacao.signIn.mockResolvedValue({ ok: false, error: 'CredentialsSignin' })
    render(<LoginPage />)
    await userEvent.type(screen.getByLabelText('Email'), 'x@x.com')
    await userEvent.type(screen.getByLabelText('Senha'), 'errada')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('Email ou senha inválidos.')).toBeInTheDocument()
    expect(roteador.push).not.toHaveBeenCalled()
  })
})

describe('página pública (landing)', () => {
  it('mostra o cardápio com preços, as etiquetas e o link para pedir no WhatsApp', async () => {
    sessaoServidor.atual = null
    receitas.mockResolvedValue([
      { id: '1', nome: 'Margherita', descricao: 'Tomate, mozzarella e manjericão', precoVenda: 42 },
      { id: '2', nome: 'Salsiccia al Gorgo', descricao: null, precoVenda: 49.9 },
    ])
    render(await Home())

    expect(screen.getByText('Margherita')).toBeInTheDocument()
    expect(screen.getByText('Tomate, mozzarella e manjericão')).toBeInTheDocument()
    expect(screen.getByText('R$ 42')).toBeInTheDocument()
    expect(screen.getByText('R$ 49,90')).toBeInTheDocument()
    expect(screen.getByText('Vegetariana')).toBeInTheDocument()
    expect(screen.getByText('Bianca · sem tomate')).toBeInTheDocument()
    const whatsapp = screen.getAllByRole('link').find((a) => a.getAttribute('href')?.startsWith('https://wa.me/5547991432494'))
    expect(whatsapp).toBeDefined()
    expect(receitas).toHaveBeenCalledWith(expect.objectContaining({ where: { ativo: true, precoVenda: { not: null } } }))
  })

  it('quem já está logado é levado ao dashboard', async () => {
    sessaoServidor.atual = { user: { id: 'u1' } }
    receitas.mockResolvedValue([])
    await Home()
    expect(redirect).toHaveBeenCalledWith('/dashboard')
  })
})
