# Qualidade

## Verificações automáticas

Toda mudança chega à `main` por pull request e passa pelas verificações abaixo antes do merge.

| Verificação | Ferramenta | Onde roda | O que pega |
|---|---|---|---|
| Lint | ESLint (`next/core-web-vitals`) | job `web` | Más práticas de React/Next, hooks, acessibilidade básica |
| Tipos | TypeScript (`tsc --noEmit`, modo `strict`) | job `web` | Erros de tipo em todo o código |
| Schema | `prisma validate` | job `web` | Schema do banco inválido |
| Build | `next build` | job `web` | Erros de compilação e de renderização |
| Testes | pytest + pytest-cov | job `ia` | Regressões no pipeline de previsão e no microsserviço |
| Qualidade | **SonarCloud** | job `sonar` | Bugs, code smells, duplicação, complexidade, *security hotspots* e cobertura |
| Segurança (SAST) | **CodeQL** (`security-and-quality`) | workflow `codeql.yml` | Injeção, XSS, vazamento de dados, uso inseguro de APIs (TypeScript e Python) |
| Dependências | **Dependabot** | semanal | Versões desatualizadas ou com vulnerabilidade conhecida (npm, pip, Docker, Actions) |

### Segurança da cadeia de suprimentos no pipeline

- Actions de terceiros (Docker, SonarSource) fixadas pelo **SHA do commit**, não pela tag, que pode ser movida.
- `npm ci --ignore-scripts`: nenhum script de instalação de pacote roda no CI; o Prisma Client é gerado explicitamente.
- Binários chamados de `node_modules/.bin` em vez de `npx`, que poderia baixar pacotes na hora.
- Python instalado de `ia/requirements-dev.lock`, com **versões e hashes travados** (`--require-hashes`) e só pacotes pré-compilados (`--only-binary :all:`).

### Quality gate

O SonarCloud usa o gate padrão (*Sonar way*) no código novo: nota A em segurança, confiabilidade e manutenibilidade, todos os *security hotspots* revisados, duplicação abaixo de 3% e **cobertura de pelo menos 80%**. Enquanto o app Next.js não tiver testes, a condição de cobertura reprova o gate; ele é informativo e não bloqueia o deploy (`sonar.qualitygate.wait=false`).

- **SonarCloud:** https://sonarcloud.io/project/overview?id=DiegoPlaninscheck_fredda-pizzaria
- **CodeQL:** aba *Security → Code scanning* do repositório

## Testes existentes

| Escopo | Arquivo | O que cobre |
|---|---|---|
| Pipeline de previsão | `ia/tests/test_previsao.py` | Leitura do CSV exportado pela tela de Vendas, séries semanais (semanas zeradas, semana incompleta fora, datas UTC → horário de Brasília), conversão da URL do Prisma, baseline, métricas, validação e previsão, sabor novo usando o baseline, intervalo de previsão que alarga com o horizonte |
| Microsserviço | `ia/tests/test_servico.py` | Autenticação por API key (inclusive falha fechada), previsão com vendas no corpo e lidas do banco, corte por data, validação da entrada, treino e troca de modelo, banco indisponível (503), métricas do Prometheus |

Cobertura atual do serviço de previsão: **~69%** (o CLI `previsao/__main__.py` e os gráficos de `analise.py` não são exercitados pelos testes).

Para rodar:

```bash
cd ia && pip install -r requirements-dev.txt && pytest --cov=previsao --cov=servico
```

> **Pendente:** testes unitários do app Next.js (Jest/Vitest) para a meta da linha Web Apps (75% no backend, 25% no frontend). O `sonar-project.properties` já lê `coverage/lcov.info` quando eles existirem.

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
