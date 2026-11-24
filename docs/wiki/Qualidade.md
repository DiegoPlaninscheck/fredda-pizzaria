# Qualidade

## Verificações automáticas

Toda mudança chega à `main` por pull request e passa pelas verificações abaixo antes do merge.

| Verificação | Ferramenta | Onde roda | O que pega |
|---|---|---|---|
| Lint | ESLint (`next/core-web-vitals`) | job `web` | Más práticas de React/Next, hooks, acessibilidade básica |
| Tipos | TypeScript (`tsc --noEmit`, modo `strict`) | job `web` | Erros de tipo em todo o código |
| Schema | `prisma validate` | job `web` | Schema do banco inválido |
| Build | `next build` | job `web` | Erros de compilação e de renderização |
| Testes do app | **Vitest** + Testing Library, MySQL de teste | job `web` | Regras de negócio, rotas, permissões e telas; **falha abaixo de 75% (backend) ou 25% (frontend)** |
| Testes da IA | pytest + pytest-cov | job `ia` | Regressões no pipeline de previsão e no microsserviço |
| Qualidade | **SonarCloud** | job `sonar` | Bugs, code smells, duplicação, complexidade, *security hotspots* e cobertura |
| Segurança (SAST) | **CodeQL** (`security-and-quality`) | workflow `codeql.yml` | Injeção, XSS, vazamento de dados, uso inseguro de APIs (TypeScript e Python) |
| Dependências | **Dependabot** | semanal | Versões desatualizadas ou com vulnerabilidade conhecida (npm, pip, Docker, Actions) |

### Segurança da cadeia de suprimentos no pipeline

- Actions de terceiros (Docker, SonarSource) fixadas pelo **SHA do commit**, não pela tag, que pode ser movida.
- `npm ci --ignore-scripts`: nenhum script de instalação de pacote roda no CI; o Prisma Client é gerado explicitamente.
- Binários chamados de `node_modules/.bin` em vez de `npx`, que poderia baixar pacotes na hora.
- Python instalado de `ia/requirements-dev.lock`, com **versões e hashes travados** (`--require-hashes`) e só pacotes pré-compilados (`--only-binary :all:`).

### Quality gate

O SonarCloud usa o gate padrão (*Sonar way*) no código novo: nota A em segurança, confiabilidade e manutenibilidade, todos os *security hotspots* revisados, duplicação abaixo de 3% e cobertura de pelo menos 80%. Ele recebe a cobertura do app (lcov do Vitest) e da IA (coverage.xml do pytest). O gate é informativo e não bloqueia o deploy (`sonar.qualitygate.wait=false`); a meta obrigatória do Portfólio é garantida pelo próprio Vitest, que falha o job `web`.

- **SonarCloud:** https://sonarcloud.io/project/overview?id=DiegoPlaninscheck_fredda-pizzaria
- **CodeQL:** aba *Security → Code scanning* do repositório

## Testes do app (Next.js)

**264 testes** com Vitest. Cobertura de linhas (meta da linha Web Apps entre parênteses):

| Grupo | O que entra | Cobertura | Meta |
|---|---|---|---|
| Backend | `lib/`, `app/api/`, `middleware.ts` | **~97%** | 75% |
| Frontend | `components/`, páginas e layouts (`app/**/*.tsx`) | **~35%** | 25% |

Os limites estão em `vitest.config.mts` (`coverage.thresholds`): abaixo deles, `npm run test:cov` falha localmente e no CI.

### Estratégia

- **Banco real, mocks só nas fronteiras.** O backend roda contra um MySQL de teste (`fredda_test`), com as mesmas migrations de produção. Assim, a baixa atômica de estoque, as transações e as transições de status são testadas de verdade, inclusive **duas baixas simultâneas** (só uma vence). São simulados apenas o que está fora do sistema: WhatsApp/Twilio e o serviço de IA (`fetch`), a API da Anthropic e a sessão do NextAuth.
- **Segurança:** o setup recusa rodar em banco cujo nome não termine em `_test`, e cada teste começa com o banco vazio.
- **Rotas chamadas direto:** os testes de API executam os handlers do Next com um `Request`, conferindo status, corpo e efeito no banco. O padrão em todo recurso é: sem sessão → 401, entrada inválida → 400, ação de ADMIN → 403 para OPERADOR e caminho feliz.
- **Telas:** Testing Library com interação de usuário (`user-event`), `fetch` simulado e o roteador e a sessão do Next mockados. Os testes verificam o que o usuário vê e o que a tela envia à API.

| Pasta | Conteúdo |
|---|---|
| `tests/backend/lib/` | Regras de domínio: estoque, pedidos, ordens, planejamento, semanas, WhatsApp/Twilio, fluxo guiado do chatbot, ferramentas da IA, agente, atendimento, autenticação |
| `tests/backend/api/` | Rotas de cadastro, operação (vendas, ordens e etapas), pedidos, conversas, simulador, webhooks, planejamento, health e metrics |
| `tests/backend/middleware.test.ts` | Toda área de `app/(dashboard)` exige login |
| `tests/frontend/` | Componentes de UI, Sidebar, telas de login, landing, pedidos, planejamento e produção |

### TDD e bugs encontrados

O projeto segue o ciclo **vermelho → verde → refatora**: primeiro um commit com o teste que falha, depois o commit da correção. Os bugs encontrados ao escrever os testes foram corrigidos assim, e cada par fica visível no histórico:

| Bug | Teste (vermelho) | Correção (verde) |
|---|---|---|
| `/planejamento` abria sem login | `44201c0` | `60eb932` |
| Chatbot: digitar "menu" no meio do pedido não saía da etapa, e o texto seguinte virava o nome do cliente | `9b20757` | `164cec1` |
| Filtro por período de vendas e movimentações usava dias em UTC (vendas da noite do último dia ficavam de fora) | `62d7a03` | `ff9f071` |
| Aviso de insumo insuficiente comparava cada receita isoladamente com o estoque | `62d7a03` | `ff9f071` |
| Confirmação do retreino do modelo sumia da tela | `7c28b94` | `6553b4b` |
| Pré-visualização da nova ordem não somava o consumo de um insumo entre receitas | `713ba0e` | `2e824c7` |

### Rodar localmente

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db   # MySQL em 127.0.0.1:3306
npm test             # todos os testes
npm run test:watch   # modo interativo (TDD)
npm run test:cov     # com cobertura e limites; relatório em coverage/index.html
```

O banco `fredda_test` é criado e migrado automaticamente (variáveis em `.env.test`).

## Testes da IA (Python)

| Escopo | Arquivo | O que cobre |
|---|---|---|
| Pipeline de previsão | `ia/tests/test_previsao.py` | Leitura do CSV exportado pela tela de Vendas, séries semanais (semanas zeradas, semana incompleta fora, datas UTC → horário de Brasília), conversão da URL do Prisma, baseline, métricas, validação e previsão, sabor novo usando o baseline, intervalo de previsão que alarga com o horizonte |
| Microsserviço | `ia/tests/test_servico.py` | Autenticação por API key (inclusive falha fechada), previsão com vendas no corpo e lidas do banco, corte por data, validação da entrada, treino e troca de modelo, banco indisponível (503), métricas do Prometheus |

Cobertura atual do serviço de previsão: **~69%** (o CLI `previsao/__main__.py` e os gráficos de `analise.py` não são exercitados pelos testes).

Para rodar:

```bash
cd ia && pip install -r requirements-dev.txt && pytest --cov=previsao --cov=servico
```

## Revisão de código

- Branch por mudança (`feat/…`, `fix/…`, `docs/…`) e pull request para a `main`.
- O PR só é integrado com o CI verde; os comentários de revisão dos colegas (PAC) e do SonarCloud são tratados no próprio PR.
- Bugs e melhorias pedidas pelo parceiro viram *issues* no GitHub, referenciadas nos commits (`Fixes #12`).

## Convenções de código

- TypeScript `strict`, imports por alias `@/`.
- Regras de negócio em `lib/`, nunca nas rotas ou páginas; rotas sempre começam por `exigirSessao()`.
- Toda alteração de estoque passa por `lib/estoque.ts`; toda mudança de status de pedido, por `lib/pedidos.ts`.
- Nomes de domínio em português (`criarPedido`, `baixarEstoqueReceita`), como a linguagem do parceiro.
- Mensagens de commit descritivas, no imperativo.
