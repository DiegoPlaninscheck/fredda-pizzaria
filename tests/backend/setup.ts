import { afterAll, afterEach, beforeEach, vi } from 'vitest'
import { limparBanco } from './helpers/db'
import { sessaoAtual } from './helpers/auth'
import { prisma } from '@/lib/prisma'

// A autenticação é a única fronteira simulada nas rotas: getServerSession devolve
// a sessão definida pelo teste com logarComo() (helpers/auth.ts).
vi.mock('next-auth', async (original) => ({
  ...(await original<typeof import('next-auth')>()),
  getServerSession: vi.fn(async () => sessaoAtual()),
}))

beforeEach(async () => {
  await limparBanco()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

afterAll(async () => {
  await prisma.$disconnect()
})
