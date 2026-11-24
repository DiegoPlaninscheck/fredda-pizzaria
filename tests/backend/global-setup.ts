import { execSync } from 'node:child_process'

/**
 * Prepara o banco de teste uma vez antes de toda a suíte do backend:
 * recria o schema a partir das migrations. Recusa qualquer banco cujo nome
 * não termine em `_test`, para nunca apagar o banco de desenvolvimento ou produção.
 */
export default function prepararBancoDeTeste() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL não definida para os testes (veja .env.test).')

  const nomeBanco = new URL(url).pathname.replace(/^\//, '')
  if (!nomeBanco.endsWith('_test')) {
    throw new Error(
      `Recusado: os testes apagam o banco "${nomeBanco}". Use um banco cujo nome termine em _test.`
    )
  }

  execSync('npx prisma migrate reset --force --skip-seed --skip-generate', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: url },
  })
}
