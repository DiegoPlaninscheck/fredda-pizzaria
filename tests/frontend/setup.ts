import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { createElement } from 'react'
import { autenticacao, navegacao, roteador } from './helpers/next'

// O recharts mede o container com ResizeObserver, que o jsdom não tem
class ResizeObserverFalso {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverFalso as unknown as typeof ResizeObserver

// Módulos do Next que dependem do servidor/roteador: substituídos por versões simples
vi.mock('next/navigation', () => ({
  useRouter: () => roteador,
  usePathname: () => navegacao.caminho,
  useParams: () => navegacao.params,
  useSearchParams: () => navegacao.busca,
  notFound: vi.fn(),
  redirect: vi.fn(),
}))

vi.mock('next/image', () => ({
  default: ({ src, alt, priority: _p, fill: _f, ...props }: Record<string, unknown>) =>
    createElement('img', { src: typeof src === 'string' ? src : '', alt, ...props }),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, prefetch: _p, ...props }: Record<string, unknown>) =>
    createElement('a', { href: String(href), ...props }, children as never),
}))

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: autenticacao.sessao, status: autenticacao.sessao ? 'authenticated' : 'unauthenticated' }),
  signIn: (...args: unknown[]) => autenticacao.signIn(...args),
  signOut: (...args: unknown[]) => autenticacao.signOut(...args),
  SessionProvider: ({ children }: { children: unknown }) => children,
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  vi.useRealTimers()
  navegacao.caminho = '/dashboard'
  navegacao.params = {}
  navegacao.busca = new URLSearchParams()
})
