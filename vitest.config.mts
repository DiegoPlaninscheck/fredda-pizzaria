import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { config as carregarEnv } from 'dotenv'

// Variáveis de teste (banco fredda_test etc.). No CI elas vêm do próprio workflow;
// valores já definidos no ambiente têm prioridade sobre o arquivo.
const env = carregarEnv({ path: '.env.test', processEnv: {}, quiet: true }).parsed ?? {}
const envTeste = Object.fromEntries(
  Object.entries(env).map(([k, v]) => [k, process.env[k] ?? v])
)
// O globalSetup roda neste processo (não nos workers), então precisa das variáveis aqui também
Object.assign(process.env, envTeste)

// Metas da linha Web Apps do Portfólio: 75% no backend e 25% no frontend.
const BACKEND = ['lib/**', 'app/api/**', 'middleware.ts']
const FRONTEND = ['components/**', 'app/**/*.tsx']

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    env: envTeste,
    projects: [
      {
        extends: true,
        test: {
          name: 'backend',
          environment: 'node',
          include: ['tests/backend/**/*.test.ts'],
          globalSetup: ['tests/backend/global-setup.ts'],
          setupFiles: ['tests/backend/setup.ts'],
          // Um único banco de teste compartilhado: os arquivos rodam um de cada vez,
          // num só processo (senão o beforeEach de um arquivo apaga os dados de outro)
          fileParallelism: false,
          pool: 'forks',
          poolOptions: { forks: { singleFork: true } },
          testTimeout: 20_000,
          hookTimeout: 60_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'frontend',
          environment: 'jsdom',
          include: ['tests/frontend/**/*.test.tsx'],
          setupFiles: ['tests/frontend/setup.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: [...BACKEND, ...FRONTEND],
      exclude: ['**/*.d.ts', 'app/api/auth/**'],
      reporter: ['text-summary', 'text', 'html', 'json-summary', 'lcov'],
      reportsDirectory: 'coverage',
      thresholds: {
        // Por grupo: o comando falha se algum grupo ficar abaixo da meta
        'lib/**': { lines: 75, statements: 75 },
        'app/api/**': { lines: 75, statements: 75 },
        'middleware.ts': { lines: 75, statements: 75 },
        '{components/**,app/**/*.tsx}': { lines: 25, statements: 25 },
      },
    },
  },
})
