# Como Contribuir

## 1. Ambiente local

Pré-requisitos: Node.js 24 LTS (versão no `.nvmrc`), Docker e (opcional) Python 3.12 para a previsão de demanda.

```bash
git clone https://github.com/DiegoPlaninscheck/fredda-pizzaria.git
cd fredda-pizzaria
cp .env.example .env                       # gere NEXTAUTH_SECRET com: openssl rand -base64 32
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db
npm install
npx prisma migrate dev && npx prisma db seed
npm run dev                                # http://localhost:3000 — admin@freddapizzaria.com / admin123
```

O passo a passo completo (incluindo o serviço de IA e o ambiente 100% Docker) está no [README](https://github.com/DiegoPlaninscheck/fredda-pizzaria#-como-rodar-localmente). Para testar o chatbot sem WhatsApp, use **Pedidos → Simular cliente**.

## 2. Fluxo de trabalho

1. Abra (ou escolha) uma *issue* descrevendo o problema ou a melhoria.
2. Crie um branch a partir da `main`: `feat/descricao-curta`, `fix/…` ou `docs/…`.
3. Trabalhe em TDD: escreva o teste que descreve o comportamento (ele falha), faça o código passar e depois refatore. Para corrigir um bug, comece por um teste que o reproduz. Use commits pequenos, com mensagens no imperativo ("Adiciona…", "Corrige…").
4. Antes de abrir o PR, rode localmente (o MySQL de dev precisa estar no ar para os testes):
   ```bash
   npm run lint && npx tsc --noEmit && npm run test:cov && npm run build
   cd ia && pytest                         # se mexeu em ia/
   ```
5. Abra o pull request para a `main`, referenciando a issue (`Fixes #N`). O CI roda sozinho.
6. Responda aos comentários de revisão e aos apontamentos do SonarCloud/CodeQL no próprio PR.
7. Depois do merge, o pipeline publica em produção e atualiza a Wiki automaticamente.

## 3. Onde mexer

| Quero… | Arquivos |
|---|---|
| Mudar uma regra de negócio | `lib/` (ex.: `lib/pedidos.ts`, `lib/estoque.ts`, `lib/planejamento.ts`) |
| Criar uma rota de API | `app/api/<recurso>/route.ts`, começando por `exigirSessao()` |
| Criar uma tela | `app/(dashboard)/<rota>/page.tsx` + componentes de `components/ui/` |
| Alterar o banco | `prisma/schema.prisma` → `npx prisma migrate dev --name <descricao>` (commite a migration) |
| Mudar o atendimento do WhatsApp | `lib/chatbot/fluxo.ts` (menu) ou `lib/chatbot/prompt.ts` e `ferramentas.ts` (IA) |
| Mudar a previsão de demanda | `ia/previsao/` + testes em `ia/tests/` |
| Adicionar ou atualizar uma dependência Python | `ia/requirements*.txt` e regenerar o lock usado pelo CI: `uv pip compile ia/requirements-dev.txt --python-platform x86_64-manylinux_2_28 --python-version 3.12 --generate-hashes --no-header -o ia/requirements-dev.lock` |
| Adicionar uma métrica | `lib/metricas.ts` e um painel em `observabilidade/grafana/dashboards/` |
| Atualizar esta documentação | `docs/wiki/*.md` (a Wiki é publicada a partir daqui) |

## 4. Regras

- Nunca commite `.env`, chaves ou dados reais de clientes (planilhas e CSVs de vendas ficam fora do Git).
- Toda mudança de comportamento vem com teste quando a parte tocada já tem testes.
- Documentação faz parte da mudança: se o PR muda um fluxo, uma rota ou a infraestrutura, atualize a página correspondente em `docs/wiki/`.
