import bcrypt from 'bcryptjs'
import { describe, expect, it } from 'vitest'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { exigirSessao } from '@/lib/api-auth'
import { logarComo } from '../helpers/auth'

// O authorize que escrevemos fica em options (o CredentialsProvider do NextAuth envolve a função)
const authorize = (authOptions.providers[0] as unknown as {
  options: { authorize: (c: Record<string, string> | undefined) => Promise<unknown> }
}).options.authorize

async function usuario(email: string, senha: string, extra: { ativo?: boolean; role?: 'ADMIN' | 'OPERADOR' } = {}) {
  return prisma.user.create({ data: { nome: 'Diego Teste', email, senha: await bcrypt.hash(senha, 4), role: extra.role ?? 'ADMIN', ativo: extra.ativo ?? true } })
}

describe('login com e-mail e senha', () => {
  it('com a senha certa devolve o usuário com o perfil', async () => {
    const u = await usuario('admin@fredda.com', 'senha-forte')
    expect(await authorize({ email: 'admin@fredda.com', senha: 'senha-forte' }))
      .toEqual({ id: u.id, name: 'Diego Teste', email: 'admin@fredda.com', role: 'ADMIN' })
  })

  it('recusa senha errada, e-mail desconhecido, usuário inativo e campos vazios', async () => {
    await usuario('ativo@fredda.com', 'certa')
    await usuario('inativo@fredda.com', 'certa', { ativo: false })
    expect(await authorize({ email: 'ativo@fredda.com', senha: 'errada' })).toBeNull()
    expect(await authorize({ email: 'ninguem@fredda.com', senha: 'certa' })).toBeNull()
    expect(await authorize({ email: 'inativo@fredda.com', senha: 'certa' })).toBeNull()
    expect(await authorize({ email: '', senha: '' })).toBeNull()
    expect(await authorize(undefined)).toBeNull()
  })

  it('o token JWT e a sessão carregam o id e o perfil (usados nas permissões)', async () => {
    const { jwt, session } = authOptions.callbacks!
    const token = await jwt!({ token: {}, user: { id: 'u1', role: 'OPERADOR' } } as never)
    expect(token).toMatchObject({ id: 'u1', role: 'OPERADOR' })
    const sessao = await session!({ session: { user: { name: 'x' }, expires: '' }, token } as never)
    expect(sessao.user).toMatchObject({ id: 'u1', role: 'OPERADOR' })
  })

  it('a sessão expira em 8 horas e usa a página de login própria', () => {
    expect(authOptions.session).toMatchObject({ strategy: 'jwt', maxAge: 8 * 60 * 60 })
    expect(authOptions.pages?.signIn).toBe('/login')
  })
})

describe('exigirSessao (usado por todas as rotas de API)', () => {
  it('sem sessão responde 401', async () => {
    logarComo(null)
    const r = await exigirSessao()
    expect(r).toBeInstanceOf(NextResponse)
    expect((r as NextResponse).status).toBe(401)
  })

  it('OPERADOR em ação exclusiva de ADMIN responde 403', async () => {
    logarComo('OPERADOR')
    const r = (await exigirSessao('ADMIN')) as NextResponse
    expect(r.status).toBe(403)
    expect(await r.json()).toEqual({ error: 'Apenas administradores podem realizar esta ação' })
  })

  it('com permissão devolve a sessão', async () => {
    logarComo('ADMIN', 'admin-1')
    expect(await exigirSessao('ADMIN')).toMatchObject({ user: { id: 'admin-1', role: 'ADMIN' } })
    logarComo('OPERADOR', 'op-1')
    expect(await exigirSessao()).toMatchObject({ user: { id: 'op-1', role: 'OPERADOR' } })
  })
})
