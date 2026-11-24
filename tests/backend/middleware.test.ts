import { readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { config } from '@/middleware'

// Todas as telas da área interna ficam em app/(dashboard)/<área>/. Cada área precisa
// estar no matcher do middleware, que redireciona para o login quem não tem sessão.
const areasInternas = readdirSync(path.join(process.cwd(), 'app', '(dashboard)'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)

describe('middleware de autenticação', () => {
  it('encontra as áreas internas do painel', () => {
    expect(areasInternas).toContain('dashboard')
    expect(areasInternas.length).toBeGreaterThan(5)
  })

  it.each(areasInternas)('protege a área /%s e suas subpáginas', (area) => {
    expect(config.matcher).toContain(`/${area}/:path*`)
  })

  it('não protege as páginas públicas (landing e login) nem as rotas de API', () => {
    const protegidas = config.matcher.join(' ')
    expect(protegidas).not.toMatch(/\/login|\/api|^\/$/)
  })
})
