# 🍕 Fredda Pizzaria — Sistema de Gestão

[![CI/CD](https://github.com/DiegoPlaninscheck/fredda-pizzaria/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/DiegoPlaninscheck/fredda-pizzaria/actions/workflows/ci-cd.yml)
[![CodeQL](https://github.com/DiegoPlaninscheck/fredda-pizzaria/actions/workflows/codeql.yml/badge.svg)](https://github.com/DiegoPlaninscheck/fredda-pizzaria/actions/workflows/codeql.yml)
[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=DiegoPlaninscheck_fredda-pizzaria&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=DiegoPlaninscheck_fredda-pizzaria)

<img src="public/fredda_pizzaria.png" alt="Fredda Pizzaria" width="96" />

Sistema web de gestão operacional desenvolvido para pizzarias especializadas em massas de longa fermentação. Integra controle de estoque de insumos, acompanhamento do processo produtivo com rastreamento de fermentação e previsão de demanda baseada em inteligência artificial.

> Projeto de portfólio — Engenharia de Software, Católica SC, 2026  
> Autor: Diego Planinscheck

**🌐 Produção:** https://pizzafredda.com.br · **📚 [Wiki](https://github.com/DiegoPlaninscheck/fredda-pizzaria/wiki)**: [requisitos](https://github.com/DiegoPlaninscheck/fredda-pizzaria/wiki/Requisitos), [user stories](https://github.com/DiegoPlaninscheck/fredda-pizzaria/wiki/User-Stories), [casos de uso](https://github.com/DiegoPlaninscheck/fredda-pizzaria/wiki/Casos-de-Uso), [arquitetura C4](https://github.com/DiegoPlaninscheck/fredda-pizzaria/wiki/Arquitetura), [decisões técnicas](https://github.com/DiegoPlaninscheck/fredda-pizzaria/wiki/Decisoes-Tecnicas), [deploy](https://github.com/DiegoPlaninscheck/fredda-pizzaria/wiki/Deploy-e-Infraestrutura), [observabilidade](https://github.com/DiegoPlaninscheck/fredda-pizzaria/wiki/Observabilidade) e [qualidade](https://github.com/DiegoPlaninscheck/fredda-pizzaria/wiki/Qualidade). As páginas ficam versionadas em [`docs/wiki/`](docs/wiki/).

---

## 🎨 Identidade visual

O sistema usa uma paleta verde/teal (`brand-*`, definida em `tailwind.config.ts`), remetendo à fermentação em geladeira que dá nome ao projeto ("fredda" = fria, em italiano):

| Tom | Hex | Uso típico |
|-----|-----|------------|
| `brand-50`  | `#f0f7f3` | Fundos suaves, etiquetas |
| `brand-700` | `#1f5439` | Links de ação, preços |
| `brand-900` | `#0f231a` | Sidebar, hero da landing, botões primários |
| `creme-50`  | `#fbf8f0` | Fundo das páginas |
| `creme-200` | `#e9dcb4` | Texto e destaques sobre o verde-escuro, item ativo da sidebar |

Os tons creme e verde-escuro vêm das artes da marca (cardápio e posts do @fredda.pizza). Os títulos usam a serifada **Zilla Slab** (`font-display`) e o texto corrido, **Inter** — ambas via `next/font` em `app/layout.tsx`.

O logo (uma fatia de pizza numa cadeira de praia dentro de um cubo de gelo) aparece na landing page, na página de login, no cabeçalho da sidebar e como favicon (`app/layout.tsx`).

**Componentes de UI** (`components/ui/`): `Button` (com estado de carregamento), `Card`, `Badge`, `PageHeader`, `ConfirmDialog` (`useConfirm()`, substitui o `window.confirm`) e `Toast` (`useToast()`, avisos de sucesso/alerta/erro). Os gráficos do dashboard usam `recharts` e os ícones, `lucide-react`.

**Landing page** (`app/page.tsx`): hero com a "Anatomia de uma Fredda", diferenciais, destaque Blume con Cipolla, cardápio com preços (receitas ativas com `precoVenda`), modo de preparo, retirada na Vila Nova e botões para o WhatsApp. As artes ficam em `public/marketing/`.

---

## 📋 Sobre o projeto

Pizzarias que trabalham com massas de longa fermentação (24–72 horas) enfrentam desafios operacionais específicos que sistemas genéricos de gestão não resolvem: controle preciso de insumos perecíveis, monitoramento de etapas de fermentação e planejamento de produção ajustado à demanda variável.

O **Fredda Pizzaria** é um sistema dedicado que resolve esses pontos com:

- Controle completo de estoque de insumos com rastreabilidade de lotes
- Ordens de produção com timer de fermentação por etapa
- Estoque de produto pronto por sabor, atualizado automaticamente por produção e vendas
- Registro de vendas com controle de pagamento e entrega
- Dashboard operacional com KPIs em tempo real
- Pedidos pelo WhatsApp com menu guiado e IA (Claude) para ajudar quando o cliente foge do roteiro
- Previsão de demanda semanal com modelo de IA treinado com dados históricos

---

## 🧩 Módulos

| Módulo | Descrição | Status |
|--------|-----------|--------|
| **Autenticação** | Login com JWT, perfis ADMIN e OPERADOR | ✅ Concluído |
| **Estoque de insumos** | CRUD, entradas/saídas, alertas, lotes | ✅ Concluído |
| **Receitas** | Fichas técnicas com ingredientes e rendimento | ✅ Concluído |
| **Processo produtivo** | Ordens de produção, timers de fermentação, condições ambientais | ✅ Concluído |
| **Vendas e estoque de produto pronto** | Registro de vendas, baixa/reposição automática de estoque de pizzas, KPIs de faturamento | ✅ Concluído |
| **Pedidos via WhatsApp (chatbot)** | Menu guiado com botões + IA (Claude Sonnet 5.5) como plano B; equipe confirma no painel | ✅ Concluído |
| **Previsão de demanda e planejamento** | Modelo preditivo (pasta [`ia/`](ia/README.md)), sugestão de produção semanal com intervalo de confiança, planejado x realizado | ✅ Concluído |

---

## 🤖 Pedidos pelo WhatsApp (chatbot)

O cliente faz o pedido pelo WhatsApp e ele cai direto no sistema. O atendimento é um **menu guiado com botões**, já que o pedido segue sempre o mesmo roteiro, e usa **IA como plano B** quando o cliente escreve algo que o menu não entende.

```
Cliente (WhatsApp) → Meta Cloud API → POST /api/whatsapp/webhook
  → valida a assinatura, ignora reenvios e responde 200 na hora
  → em segundo plano (fila por cliente):
      fluxo guiado (lib/chatbot/fluxo.ts) ── entendeu ──→ próxima etapa (botões/lista)
            └── não entendeu ──→ IA (Claude) com o contexto do carrinho ──→ resposta + [Continuar pedido] [Menu]
                                   └── IA desligada/falhou ──→ "não entendi" + opções da etapa
Pedido criado = "Aguardando confirmação" (pizzas reservadas no estoque) → aparece em /pedidos
  → equipe confirma (gera as vendas) → entregue   |   cancelado (estoque devolvido)
  → cada mudança de status é avisada ao cliente pelo WhatsApp
```

**Fluxo guiado:** menu (Fazer pedido · Meus pedidos · Atendente) → sabores (lista do WhatsApp, paginada de 9 em 9 quando passa de 10) → quantidade (botões 1/2/3 ou número digitado) → carrinho (Outro sabor · Finalizar · Esvaziar) → nome (só no primeiro pedido) → retirada ou entrega → endereço (oferece o último usado) → forma de pagamento → resumo e confirmação. Em "Meus pedidos" o cliente vê o status e pode cancelar um pedido que ainda aguarda confirmação. O fluxo também entende texto digitado que corresponde às opções ("calabrese", "pix", "sim", "menu").

**IA (plano B):** entra quando o cliente escreve algo fora do menu, como uma dúvida ("vocês entregam em Blumenau?") ou um pedido por extenso ("quero 2 calabresas pra sábado"). Ela recebe a etapa e o carrinho em que o cliente parou, usa as mesmas regras de negócio (ferramentas em `lib/chatbot/ferramentas.ts`) e, se não souber algo (preparo, ingredientes, área de entrega), chama um atendente em vez de inventar. **Sem `ANTHROPIC_API_KEY` o atendimento funciona só com o menu.**

**Segurança:** o cliente é identificado no servidor pelo telefone do WhatsApp, e nem o menu nem a IA escolhem de quem é o pedido; uma mensagem maliciosa não acessa dados de outro cliente. Os preços são sempre recalculados a partir do cardápio, e o webhook só aceita requisições assinadas pela Meta (`X-Hub-Signature-256`).

**Modelo e custo da IA:** `claude-sonnet-5-5` com effort `low`, prompt caching e *fallback* automático para outro modelo em caso de recusa. Como a IA só responde mensagens fora do menu, o custo fica abaixo dos US$ 0,01–0,03 que um pedido inteiro conversado custaria.

**Painel:** `/pedidos` lista os pedidos (atualiza a cada 15s) e os clientes aguardando atendente; o detalhe do pedido mostra a conversa e os botões Confirmar / Entregue / Cancelar; a tela da conversa permite responder o cliente pelo próprio painel. A navegação lateral mostra um contador de pedidos pendentes.

> Só receitas com **preço de venda** preenchido (e estoque de produto pronto) aparecem no cardápio do chatbot.

### Testar sem WhatsApp: simulador

Em **Pedidos → 💬 Simular cliente** (`/pedidos/simulador`) há uma tela que imita o WhatsApp, com os mesmos botões e listas. Ela passa exatamente pelo mesmo atendimento do webhook e funciona sem WhatsApp e sem chave da Anthropic. Os pedidos criados ali são reais (reservam estoque e aparecem em `/pedidos`) e ficam identificados como "Simulador"; o simulador só aceita telefones de teste começando com `000`, que nunca são enviados para a Meta.

### Configurar o WhatsApp (Meta Cloud API)

1. Em [developers.facebook.com](https://developers.facebook.com), crie um app do tipo **Empresa** e adicione o produto **WhatsApp**. A Meta fornece um número de teste (dá para cadastrar até 5 números de destino para testar).
2. Copie para o `.env`: o **token de acesso** (`WHATSAPP_TOKEN` — em produção, gere um token permanente de um *usuário do sistema* no Business Manager), a **identificação do número de telefone** (`WHATSAPP_PHONE_NUMBER_ID`) e a **chave secreta do app**, em Configurações → Básico (`WHATSAPP_APP_SECRET`). Invente um texto para `WHATSAPP_VERIFY_TOKEN`.
3. O webhook exige **HTTPS público**:
   - **Na VPS:** aponte um domínio para o IP do servidor, preencha `DOMINIO` no `.env`, libere as portas 80/443 e suba com `docker compose --profile https up -d` — o Caddy emite o certificado sozinho. Ajuste `NEXTAUTH_URL` para `https://<seu domínio>`.
   - **Em desenvolvimento:** `cloudflared tunnel --url http://localhost:3000` (ou ngrok) gera uma URL HTTPS temporária.
4. Em WhatsApp → Configuração, cadastre a URL `https://<domínio>/api/whatsapp/webhook` com o mesmo `WHATSAPP_VERIFY_TOKEN` e assine o campo **messages**.

### Alternativa: WhatsApp Sandbox da Twilio

Para responder clientes pela Meta, a conta precisa da **verificação da empresa** (CNPJ). Sem ela, dá para demonstrar o bot com o Sandbox da Twilio, que funciona na conta trial.

1. No console da Twilio (versão *legacy*), abra **Messaging → Try it out → Send a WhatsApp message**. Cada celular que for testar envia `join <código do sandbox>` para o número do Sandbox (a inscrição vale por 3 dias).
2. No `.env`: `WHATSAPP_PROVEDOR="twilio"`, `TWILIO_ACCOUNT_SID` e `TWILIO_AUTH_TOKEN` (em *Account Info*, na página inicial do console).
3. Em **Sandbox settings → When a message comes in**, cadastre `https://<domínio>/api/whatsapp/twilio` (método POST).

O webhook (`/api/whatsapp/twilio`) valida a assinatura `X-Twilio-Signature` e passa pelo mesmo atendimento. Como mensagens livres na Twilio não têm botões nem listas, as opções vão numeradas (1️⃣ 2️⃣ 3️⃣…) e o cliente responde com o número ou com o nome da opção.

**Limitações conhecidas:**
- Pela regra do WhatsApp, mensagens livres (avisos de status, respostas da equipe) só podem ser enviadas até 24h depois da última mensagem do cliente. Fora dessa janela o aviso não é enviado e o painel informa. Enviar *templates* aprovados pela Meta fica para uma próxima etapa.
- A fila que ordena as mensagens de cada cliente fica em memória, o que funciona com uma única instância do app (o cenário da VPS).

---

## 📈 Planejamento de produção (previsão de demanda)

Em **Planejamento** (`/planejamento`) a equipe escolhe uma semana (da próxima até 7 semanas à frente) e o sistema sugere quantas pizzas de cada sabor produzir:

```
Painel → GET /api/planejamento/sugestao?semana=AAAA-MM-DD
  → microsserviço ia (POST /previsao, X-API-Key) → previsão por sabor + intervalo de 80%
  → estoque projetado = estoque atual + ordens em andamento − demanda prevista até a semana
  → sugerido = previsão − estoque projetado (ou limite superior − estoque, na opção "Limite superior")
```

- **Previsão de venda** mostra o valor previsto e a faixa de 80% (em 8 de cada 10 semanas a venda deve ficar dentro dela). A opção **Limite superior** planeja pela ponta de cima da faixa, para reduzir o risco de faltar massa.
- A coluna **Planejado** começa com a sugestão e pode ser ajustada. **Salvar plano** guarda a semana (previsão, faixa, estoque e quantidades) e **Criar ordem de produção** gera a ordem com as quantidades planejadas.
- Se o microsserviço estiver fora do ar ou sem histórico, a tela avisa e o plano pode ser feito à mão.
- Administradores têm o botão **Retreinar modelo**, que treina de novo com as vendas mais recentes.

**Planejado x realizado** (`/planejamento/comparacao`) compara, para cada semana com plano salvo, a previsão e o planejado com a produção (ordens concluídas na semana) e as vendas. Os indicadores mostram o erro médio da previsão, a porcentagem de vendas dentro da faixa prevista e quanto do planejado foi produzido. As semanas vão de segunda a domingo no horário de Brasília.

Configuração: `IA_URL` e `IA_API_KEY` no `.env` (no Docker, o `IA_URL` já aponta para o serviço `ia`).

---

## 📱 Responsividade

A área autenticada foi adaptada para uso em celular:

- **Navegação:** em telas `< md`, a sidebar vira um menu retrátil (drawer) acionado por um botão hambúrguer no topo, com overlay escurecido e fechamento automático ao trocar de rota. Em telas `md+` continua fixa, como no desktop.
- **Tabelas** (vendas, estoque, fornecedores, categorias, movimentações) ganharam scroll horizontal próprio (`overflow-x-auto`) em vez de espremer colunas ou quebrar o layout da página.
- **Cabeçalhos de página e cards** (ex.: lista de receitas, formulário de nova receita) usam `flex-wrap`/empilhamento em coluna no mobile, para título, ações e campos de formulário não serem cortados na tela.

---

## 🛠️ Stack tecnológico

| Camada | Tecnologia |
|--------|-----------|
| Frontend + Backend | [Next.js 14](https://nextjs.org/) (App Router) |
| ORM | [Prisma](https://www.prisma.io/) |
| Banco de dados | MySQL 8 |
| Autenticação | [NextAuth.js](https://next-auth.js.org/) v4 (Credentials + JWT) |
| Containerização | Docker + Docker Compose |
| Chatbot de pedidos | [Claude API](https://docs.anthropic.com) (`@anthropic-ai/sdk`, Claude Sonnet 5.5) + WhatsApp Cloud API |
| IA / Previsão | Python (FastAPI + scikit-learn) |
| Proxy HTTPS | [Caddy](https://caddyserver.com/) (certificado automático) |
| Hospedagem | VPS (Hostinger) |
| CI/CD | GitHub Actions + GHCR, deploy por runner self-hosted na VPS |
| Qualidade e segurança | SonarCloud, CodeQL, Dependabot |
| Observabilidade | Prometheus + Grafana (métricas técnicas e de negócio, alertas) |

---

## 🚀 Como rodar localmente

### Pré-requisitos

- Node.js 24 LTS (versão no `.nvmrc`; com nvm: `nvm use`)
- Docker e Docker Compose
- Python 3.12+ *(opcional — só para rodar a previsão de demanda fora do Docker, veja o passo 6)*

### 1. Clone o repositório

```bash
git clone https://github.com/DiegoPlaninscheck/fredda-pizzaria.git
cd fredda-pizzaria
```

### 2. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env` e gere uma chave secreta:

```bash
openssl rand -base64 32   # cole o resultado em NEXTAUTH_SECRET
```

### 3. Suba o banco com Docker

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db
```

O `docker-compose.yml` principal não publica a porta do MySQL (na VPS o banco fica só na rede interna). O [`docker-compose.dev.yml`](docker-compose.dev.yml) acrescenta `127.0.0.1:3306`, para o Prisma e o `npm run dev` acessarem o banco a partir da sua máquina com a `DATABASE_URL` padrão do `.env.example`.

### 4. Instale as dependências e rode as migrations

```bash
npm install
npx prisma migrate dev
npx prisma db seed
```

### 5. Inicie o servidor de desenvolvimento

```bash
npm run dev
```

Acesse em [http://localhost:3000](http://localhost:3000)

**Credenciais do seed:** `admin@freddapizzaria.com` / `admin123`

**Perfis:** `OPERADOR` faz a operação do dia a dia (movimentações, ordens, vendas, pedidos). Excluir/inativar fornecedores, categorias, insumos e receitas e cancelar vendas é exclusivo do `ADMIN`.

### Testes

Com o MySQL do passo 3 no ar:

```bash
npm test             # 264 testes (Vitest): backend contra o banco fredda_test + telas
npm run test:cov     # com cobertura; falha abaixo de 75% no backend ou 25% no frontend
```

O banco de teste é criado e migrado sozinho (`.env.test`). Estratégia, cobertura atual e o histórico de TDD estão em [Qualidade](https://github.com/DiegoPlaninscheck/fredda-pizzaria/wiki/Qualidade).

### 6. (Opcional) Previsão de demanda

Sem o microsserviço `ia` rodando, o sistema funciona normalmente, mas a tela de **Planejamento** avisa que não há previsão e o plano é feito à mão. Para usar a previsão em desenvolvimento, defina `IA_API_KEY` no `.env` e suba o serviço na porta 8000 (a mesma do `IA_URL` padrão), conforme o [`ia/README.md`](ia/README.md#microsserviço-fastapi):

```bash
cd ia
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn servico.app:app --port 8000
```

Use no terminal do `uvicorn` a mesma `IA_API_KEY` e `DATABASE_URL` do `.env`.

---

## 🐳 Rodar com Docker (ambiente completo)

```bash
docker compose up --build -d
```

O compose também sobe o microsserviço de previsão de demanda (`ia`), acessível só pela rede interna; defina `IA_API_KEY` no `.env` (veja [`ia/README.md`](ia/README.md#microsserviço-fastapi)). O `docker-entrypoint.sh` aplica as migrations (`prisma migrate deploy`) automaticamente antes de iniciar o servidor — não precisa rodar nada manualmente após o `up`. Para popular o banco com os dados de exemplo:

```bash
docker compose exec app npm run db:seed
```

Para expor o app com HTTPS (necessário para o webhook do WhatsApp), suba também o Caddy: `docker compose --profile https up -d` (veja [Configurar o WhatsApp](#configurar-o-whatsapp-meta-cloud-api)).

Para subir também o monitoramento (Prometheus + Grafana em http://localhost:3001), defina `METRICS_TOKEN` e `GRAFANA_ADMIN_PASSWORD` no `.env` e use `docker compose --profile observabilidade up --build -d` (veja [Observabilidade](https://github.com/DiegoPlaninscheck/fredda-pizzaria/wiki/Observabilidade)).

### Deploy em produção (pipeline CI/CD)

O deploy é **automático**: cada push na `main` passa pelo pipeline [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml):

1. **CI:** lint, checagem de tipos e build do Next.js; testes do serviço de previsão; análise no SonarCloud (e CodeQL em paralelo).
2. **Imagens:** as imagens do app e da IA são publicadas no GHCR, marcadas com o commit.
3. **Deploy:** um runner do GitHub Actions instalado na VPS faz backup do banco, baixa as imagens, recria os containers (`app`, `ia`, `db`, Prometheus, Grafana) e testa `/api/health`. Se o teste falhar, o job falha.

Ninguém acessa a VPS para publicar uma versão, e o rollback é rodar de novo o deploy de um commit anterior. O provisionamento inicial da VPS (Caddy no host, usuário e runner, `/opt/fredda/.env`), as variáveis obrigatórias e o procedimento de rollback estão em [Deploy e Infraestrutura](https://github.com/DiegoPlaninscheck/fredda-pizzaria/wiki/Deploy-e-Infraestrutura).

Em produção, o app e o Grafana escutam só em `127.0.0.1` e o acesso externo passa pelo Caddy, com HTTPS; libere apenas as portas 80 e 443. Todos os serviços usam `restart: unless-stopped`. **Não** use o `docker-compose.dev.yml` na VPS: ele expõe a porta do banco.

> A imagem gera o Prisma Client com `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` no `schema.prisma`, necessário para rodar corretamente em containers Alpine.

---

## 📁 Estrutura do projeto

```
fredda-pizzaria/
├── .github/
│   ├── workflows/ci-cd.yml         # Pipeline: lint, tipos, build, testes, Sonar, imagens, deploy e Wiki
│   ├── workflows/codeql.yml        # Análise de segurança (CodeQL)
│   └── dependabot.yml              # Atualização automática de dependências
├── app/
│   ├── (auth)/                     # Rotas públicas
│   │   └── login/                  # Página de login
│   ├── (dashboard)/                # Área autenticada (requer sessão)
│   │   ├── dashboard/              # Dashboard com KPIs reais
│   │   ├── pedidos/                # Pedidos do WhatsApp e clientes aguardando atendente
│   │   │   ├── simulador/          # Simulador do WhatsApp para testar o atendimento
│   │   │   ├── [id]/               # Detalhe do pedido + conversa + confirmar/entregar/cancelar
│   │   │   └── conversas/[id]/     # Conversa: responder o cliente, assumir/devolver ao bot
│   │   ├── planejamento/           # Sugestão de produção semanal (previsão + intervalo)
│   │   │   └── comparacao/         # Planejado x realizado
│   │   ├── producao/               # Painel de ordens de produção
│   │   │   ├── nova/               # Criar nova ordem com verificação de estoque
│   │   │   └── [id]/               # Detalhe da ordem + timers de fermentação
│   │   ├── receitas/               # Lista de fichas técnicas (com estoque de produto pronto)
│   │   │   └── nova/               # Criar/editar receita com ingredientes
│   │   ├── vendas/                 # Histórico de vendas com filtros e exportação CSV
│   │   │   └── nova/               # Registrar venda (cliente, pagamento, entrega)
│   │   ├── estoque/                # Lista, detalhe, novo insumo
│   │   │   └── [id]/               # Detalhe + movimentação (entrada/saída)
│   │   ├── fornecedores/           # Lista, novo, editar fornecedor
│   │   │   └── [id]/editar/
│   │   └── categorias/             # CRUD inline de categorias
│   ├── api/
│   │   ├── auth/[...nextauth]/     # Handler NextAuth.js
│   │   ├── categorias/             # GET, POST, PUT, DELETE
│   │   ├── fornecedores/           # GET (busca+filtro), POST, PUT, DELETE
│   │   ├── insumos/                # GET (filtros), POST, PUT, DELETE
│   │   │   └── [id]/movimentacoes/ # Histórico e registro de movimentações
│   │   ├── receitas/               # GET, POST, PUT, DELETE (soft)
│   │   ├── vendas/                 # GET (filtros), POST (baixa estoque de produto pronto)
│   │   │   └── [id]/               # PATCH (pago/entregue), DELETE (ADMIN, estorna estoque)
│   │   ├── pedidos/                # GET (filtro por status), resumo para o badge
│   │   │   └── [id]/               # GET, PATCH (confirmar/entregar/cancelar + aviso no WhatsApp)
│   │   ├── conversas/              # Conversas com atendente, resposta manual, assumir/devolver
│   │   ├── whatsapp/webhook/       # Webhook da Meta (verificação + mensagens recebidas)
│   │   ├── whatsapp/twilio/        # Webhook da Twilio (Sandbox do WhatsApp)
│   │   ├── chatbot/simulador/      # Atendimento simulado (telefones 000…, sem envio à Meta)
│   │   ├── health/                 # Health check público (app + banco), usado pelo deploy
│   │   ├── metrics/                # Métricas para o Prometheus (exige METRICS_TOKEN)
│   │   ├── planejamento/           # GET/PUT do plano da semana; sugestao/, comparacao/, modelo/ (retreino, ADMIN)
│   │   └── ordens/                 # GET, POST, PATCH (conclusão repõe estoque de produto pronto)
│   │       └── [id]/etapas/[etapaId]/
│   │           └── condicoes/      # Registro de temperatura, umidade, observações
│   ├── page.tsx                    # Landing page pública (cardápio, WhatsApp)
│   ├── layout.tsx                  # Layout raiz: fontes, favicon e providers
│   └── providers.tsx               # Client providers (SessionProvider)
├── components/
│   ├── Sidebar.tsx                 # Navegação lateral
│   ├── Transcricao.tsx             # Conversa do WhatsApp em balões
│   ├── dashboard/                  # Gráfico de faturamento semanal (recharts)
│   └── ui/                         # Button, Card, Badge, PageHeader, ConfirmDialog, Toast
├── lib/
│   ├── auth.ts                     # authOptions (NextAuth config)
│   ├── api-auth.ts                 # exigirSessao(role?) usado em todas as rotas de API
│   ├── constantes.ts               # Formas de pagamento e limites de pedido
│   ├── estoque.ts                  # Baixa atômica de estoque (sem estoque negativo em acessos simultâneos)
│   ├── ordens.ts                   # Concluir/cancelar ordem (reposição e estorno de insumos)
│   ├── ia.ts                       # Cliente do microsserviço de previsão (IA_URL + X-API-Key)
│   ├── planejamento.ts             # Sugestão de produção e planejado x realizado
│   ├── semanas.ts                  # Semanas de segunda a domingo no horário de Brasília
│   ├── pedidos.ts                  # Criar/confirmar/entregar/cancelar pedidos
│   ├── pedidos-ui.ts               # Rótulos de status para as telas (sem Prisma, usável no cliente)
│   ├── whatsapp.ts                 # Envio, assinatura do webhook e fila por cliente
│   ├── twilio.ts                   # Adaptador Twilio: envio, opções numeradas e assinatura
│   ├── chatbot/
│   │   ├── atendimento.ts          # Orquestração: decide entre fluxo guiado e IA
│   │   ├── fluxo.ts                # Menu guiado (etapas, botões, listas, carrinho)
│   │   ├── agente.ts               # IA plano B (Claude) com ferramentas
│   │   ├── ferramentas.ts          # Regras de negócio expostas à IA
│   │   ├── prompt.ts               # System prompt (estático, para prompt caching)
│   │   ├── mensagens.ts            # Textos e limites das mensagens interativas
│   │   ├── conversas.ts            # Histórico e estado das conversas
│   │   └── notificar.ts            # Avisos de status ao cliente (janela de 24h)
│   ├── metricas.ts                 # Métricas do Prometheus (Node + negócio)
│   └── prisma.ts                   # Singleton do PrismaClient
├── observabilidade/
│   ├── prometheus.yml              # Alvos de coleta
│   ├── alertas.yml                 # Regras de alerta
│   └── grafana/                    # Datasource e dashboard provisionados
├── docs/wiki/                      # Páginas da Wiki (publicadas pelo pipeline)
├── prisma/
│   ├── schema.prisma               # 20 models (resumo na seção abaixo)
│   ├── migrations/                 # Histórico de migrations
│   └── seed.ts                     # Dados iniciais
├── ia/                             # Previsão de demanda em Python (ver ia/README.md)
│   ├── previsao/                   # Preparação, análise, modelos e CLI
│   ├── servico/                    # Microsserviço FastAPI (/previsao, /treinar)
│   └── tests/
├── public/
│   ├── fredda_pizzaria.png         # Logo / favicon
│   └── marketing/                  # Artes usadas na landing page
├── tests/
│   ├── backend/                    # Vitest contra o MySQL fredda_test: lib/ (domínio) e api/ (rotas)
│   └── frontend/                   # Vitest + Testing Library: componentes e telas
├── vitest.config.mts               # Projetos backend/frontend e metas de cobertura (75% / 25%)
├── .env.test                       # Variáveis dos testes (banco fredda_test, sem segredos)
├── types/
│   └── next-auth.d.ts              # Extensão de tipos (id, role na sessão)
├── middleware.ts                   # Proteção de rotas autenticadas
├── Caddyfile                       # Proxy HTTPS (perfil "https" do docker-compose)
├── docker-compose.yml              # db, app, ia; perfis "observabilidade" e "https"
├── sonar-project.properties        # Configuração do SonarCloud
├── docker-compose.dev.yml          # Dev local: publica o MySQL em 127.0.0.1:3306
├── Dockerfile                      # Build multi-stage + Prisma Client para Alpine (musl)
├── docker-entrypoint.sh            # Aplica migrations automaticamente antes de iniciar o server
├── .dockerignore
└── .env.example
```

---

## 🗄️ Schema do banco de dados

Resumo dos models e campos principais. A definição completa está em [`prisma/schema.prisma`](prisma/schema.prisma).

```text
User                 — id, nome, email, senha (bcrypt), role (ADMIN | OPERADOR), ativo
Fornecedor           — id, nome, cnpj (só dígitos, validado), telefone, email, endereco, ativo
Categoria            — id, nome (unique), descricao, ativo
Insumo               — id, nome, unidade, estoqueAtual, estoqueMinimo, precoUnitario,
                       categoriaId, fornecedorId, ativo
MovimentacaoEstoque  — id, tipo (ENTRADA | SAIDA), quantidade, lote, dataVencimento,
                       precoUnitario, motivo, insumoId, fornecedorId, usuarioId,
                       ordemId (baixa/estorno gerados por ordem de produção)

Receita              — id, nome, descricao, rendimento (Decimal), estoqueAtual (Decimal, produto pronto),
                       precoVenda (cardápio do chatbot), ativo
ReceitaInsumo        — id, receitaId, insumoId, quantidade (Decimal); unique(receitaId,insumoId)
OrdemProducao        — id, status (PLANEJADA|EM_ANDAMENTO|PAUSADA|CONCLUIDA|CANCELADA),
                       dataPrevista, observacoes, usuarioId
                       (ao criar, baixa os insumos disponíveis; ao concluir, incrementa o estoque
                        de cada receita; ao cancelar, estorna os insumos baixados)
OrdemReceita         — id, ordemId, receitaId, quantidade; unique(ordemId,receitaId)
EtapaFermentacao     — id, nome (MISTURA|DESCANSO_INICIAL|FERMENTACAO_LONGA|MODELAGEM|CONGELAMENTO),
                       ordem, status (PENDENTE|EM_ANDAMENTO|PAUSADA|CONCLUIDA),
                       duracaoMinutos, minutosDecorridos, iniciadaEm, concluidaEm, ordemId
RegistroCondicoes    — id, temperatura, umidade, observacoes, createdAt, etapaId

Venda                — id, cliente, quantidade (Decimal), precoUnitario, valorTotal,
                       formaPagamento, pago, entregue, dataVenda, dataEntrega, observacoes,
                       receitaId, usuarioId, pedidoId (ao registrar, decrementa Receita.estoqueAtual)

Cliente              — id, nome, telefone (wa_id do WhatsApp, único), endereco
Pedido               — id (número do pedido), status (PENDENTE|CONFIRMADO|ENTREGUE|CANCELADO),
                       canal (WHATSAPP|MANUAL), tipoEntrega (RETIRADA|ENTREGA), enderecoEntrega,
                       formaPagamento, dataEntregaDesejada, observacoes, valorTotal, clienteId, conversaId
PedidoItem           — id, pedidoId, receitaId, quantidade, precoUnitario (preço do cardápio no momento)
Conversa             — id, clienteId, status (BOT|HUMANO|ENCERRADA), historico (JSON com as mensagens
                       no formato da API da Anthropic), estadoFluxo (JSON: etapa do menu e carrinho),
                       ultimaMensagemEm
MensagemWhatsApp     — id, waMessageId (único, evita reprocessar reenvios), direcao, texto, conversaId
PlanoProducao        — id, semana (segunda-feira, única), modeloAtivo, observacoes, usuarioId
PlanoProducaoItem    — id, planoId, receitaId, previsao, limiteInferior, limiteSuperior, metodo,
                       estoqueInicial (projetado), sugerido, planejado
```

---

## 🗓️ Roadmap

### Sprint 1 — Fundação (semanas 1–2)
- [x] Setup do repositório e README
- [x] Projeto Next.js 14 + TypeScript + Tailwind CSS
- [x] Prisma ORM com schema inicial (User, Fornecedor, Categoria, Insumo)
- [x] Autenticação com NextAuth.js (Credentials + JWT)
- [x] Docker Compose com MySQL 8 e build standalone
- [x] Seed inicial do banco de dados

### Sprint 2 — Estoque de insumos (semanas 3–4)
- [x] CRUD de categorias (com ativar/inativar) e fornecedores
- [x] Validação de CNPJ (dígitos verificadores) no cadastro de fornecedores
- [x] CRUD de insumos com unidade de medida e estoque mínimo
- [x] Registro de entradas com número de lote e data de validade
- [x] Registro de saídas com validação de saldo suficiente
- [x] Histórico de movimentações com filtros, saldo acumulado e exportação CSV
- [x] Alertas de estoque mínimo no dashboard e navegação lateral
- [x] Dashboard com KPIs reais

### Sprint 3 — Processo produtivo (semanas 5–6)
- [x] Fichas técnicas de receitas com ingredientes e rendimento
- [x] Ordens de produção com validação de estoque
- [x] Etapas de fermentação padrão com timers (Iniciar/Pausar/Concluir)
- [x] Registro de condições ambientais (temperatura, umidade, observações)
- [x] Painel de ordens com progresso e atualização automática

### Sprint 4 — Dados e planejamento (semanas 7–8)
- [x] Registro de vendas e estoque de produto pronto por sabor
- [x] Dashboard com KPIs de vendas
- [x] Exportação/importação de dados históricos em CSV
- [x] Rebrand visual e responsividade mobile

### Entregas extras — pedidos pelo WhatsApp
- [x] Correções de consistência: baixa de insumos pela ordem de produção, estoque atômico em vendas/saídas, alertas de estoque mínimo, permissões por perfil
- [x] Edição (pago/entregue) e cancelamento de vendas com estorno
- [x] Pedidos pelo WhatsApp: menu guiado com botões, IA (Claude Sonnet 5.5) como plano B, painel de pedidos, atendimento humano e simulador

### Sprint 5 — Modelagem de IA (semanas 9–10)
- [x] Coleta e preparação dos dados históricos de vendas (MySQL ou CSV exportado → séries semanais por sabor)
- [x] Análise exploratória e definição da abordagem (gradient boosting global; SARIMA/Prophet reavaliados com 2+ anos de dados)
- [x] Implementação do baseline (fallback) e treinamento do modelo principal — ver [`ia/README.md`](ia/README.md)

### Sprint 6 — Avaliação e microsserviço (semanas 11–12)
- [x] Ajuste de hiperparâmetros (busca aleatória com validação cruzada temporal) e avaliação (MAE/RMSE/MAPE/WAPE)
- [x] Microsserviço FastAPI + scikit-learn com endpoint REST protegido por API key — ver [`ia/README.md`](ia/README.md#microsserviço-fastapi)

### Sprint 7 — Integração (semanas 13–14)
- [x] Integração do microsserviço com a aplicação principal
- [x] Sugestão de produção semanal com intervalo de confiança
- [x] Tela de comparação planejado x realizado

### Sprint 8 — Deploy e validação (semanas 15–16)
- [x] Pipeline CI/CD (GitHub Actions) com deploy automático na VPS
- [x] Deploy completo (app + IA + observabilidade) na VPS
- [x] Análise estática (SonarCloud, CodeQL) e Wiki com requisitos, C4 e ADRs
- [x] Testes automatizados do app com TDD (backend ~97%, frontend ~35%)
- [ ] Testes finais com o parceiro e documentação final

---

## 🔗 Links úteis

- [Ambiente de produção](https://pizzafredda.com.br)
- [Wiki do projeto](https://github.com/DiegoPlaninscheck/fredda-pizzaria/wiki)
- [Dashboard de observabilidade (Grafana)](https://grafana.pizzafredda.com.br) *(com login)*
- [SonarCloud](https://sonarcloud.io/summary/new_code?id=DiegoPlaninscheck_fredda-pizzaria)
- [Jira — Gerenciamento do projeto](https://diegoplanichek.atlassian.net)
- [API do microsserviço de previsão](ia/README.md#microsserviço-fastapi) (documentação interativa em `/docs` com o serviço rodando)

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

## 👤 Autor

**Diego Planinscheck**  
Católica SC — Engenharia de Software, 2026  
[diego.planinscheck@catolicasc.edu.br](mailto:diego.planinscheck@catolicasc.edu.br)
