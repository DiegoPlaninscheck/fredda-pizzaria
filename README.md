# 🍕 Fredda Pizzaria — Sistema de Gestão

<img src="public/fredda_pizzaria.png" alt="Fredda Pizzaria" width="96" />

Sistema web de gestão operacional desenvolvido para pizzarias especializadas em massas de longa fermentação. Integra controle de estoque de insumos, acompanhamento do processo produtivo com rastreamento de fermentação e previsão de demanda baseada em inteligência artificial.

> Projeto de portfólio — Engenharia de Software, Católica SC, 2026  
> Autor: Diego Planinscheck

---

## 🎨 Identidade visual

O sistema usa uma paleta verde/teal (`brand-*`, definida em `tailwind.config.ts`), remetendo à fermentação em geladeira que dá nome ao projeto ("fredda" = fria, em italiano):

| Tom | Hex | Uso típico |
|-----|-----|------------|
| `brand-50`  | `#f0f7f3` | Fundos suaves, hover de itens de menu |
| `brand-500` | `#3d8563` | Realces, ícones ativos |
| `brand-600` | `#2b6b4d` | Botões primários, links de ação |
| `brand-700` | `#1f5439` | Hover de botões primários |
| `brand-900` | `#0f231a` | Texto sobre fundos claros da marca |

O logo (uma fatia de pizza numa cadeira de praia dentro de um cubo de gelo) aparece na página de login, no cabeçalho da sidebar e como favicon (`app/layout.tsx`).

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
| **Previsão de demanda** | Modelo preditivo (pasta [`ia/`](ia/README.md)), sugestão de produção | 🚧 Em andamento (modelo pronto, falta o microsserviço e a integração) |

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

**Limitações conhecidas:**
- Pela regra do WhatsApp, mensagens livres (avisos de status, respostas da equipe) só podem ser enviadas até 24h depois da última mensagem do cliente. Fora dessa janela o aviso não é enviado e o painel informa. Enviar *templates* aprovados pela Meta fica para uma próxima etapa.
- A fila que ordena as mensagens de cada cliente fica em memória, o que funciona com uma única instância do app (o cenário da VPS).

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
| Hospedagem | VPS (Hostinger) |
| CI/CD | GitHub Actions |

---

## 🚀 Como rodar localmente

### Pré-requisitos

- Node.js 20+
- Docker e Docker Compose

### 1. Clone o repositório

```bash
git clone https://github.com/diegoplaninscheck/fredda-pizzaria.git
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
docker compose up -d db
```

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

---

## 🐳 Rodar com Docker (ambiente completo)

```bash
docker compose up --build -d
```

O `docker-entrypoint.sh` aplica as migrations (`prisma migrate deploy`) automaticamente antes de iniciar o servidor — não precisa rodar nada manualmente após o `up`. Para popular o banco com os dados de exemplo:

```bash
docker compose exec app npm run db:seed
```

Para expor o app com HTTPS (necessário para o webhook do WhatsApp), suba também o Caddy: `docker compose --profile https up -d` (veja [Configurar o WhatsApp](#configurar-o-whatsapp-meta-cloud-api)).

### Deploy em produção (VPS)

O projeto está preparado para rodar em qualquer VPS com Docker (testado na Hostinger):

1. Clone o repositório no servidor e configure o `.env` com senhas fortes e `NEXTAUTH_URL` apontando para o IP/domínio público
2. `docker compose up --build -d` — builda a imagem, sobe o MySQL e aplica as migrations sozinho
3. Libere a porta 3000 no firewall (`ufw allow 3000/tcp`)
4. A aplicação sobrevive a reboot do servidor (`restart: unless-stopped` no `docker-compose.yml`) — não precisa iniciar nada manualmente depois do primeiro deploy

> A imagem gera o Prisma Client com `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` no `schema.prisma`, necessário para rodar corretamente em containers Alpine.

---

## 📁 Estrutura do projeto

```
fredda-pizzaria/
├── app/
│   ├── (auth)/                     # Rotas públicas
│   │   └── login/                  # Página de login
│   ├── (dashboard)/                # Área autenticada (requer sessão)
│   │   ├── dashboard/              # Dashboard com KPIs reais
│   │   ├── pedidos/                # Pedidos do WhatsApp e clientes aguardando atendente
│   │   │   ├── simulador/          # Simulador do WhatsApp para testar o atendimento
│   │   │   ├── [id]/               # Detalhe do pedido + conversa + confirmar/entregar/cancelar
│   │   │   └── conversas/[id]/     # Conversa: responder o cliente, assumir/devolver ao bot
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
│   │   ├── chatbot/simulador/      # Atendimento simulado (telefones 000…, sem envio à Meta)
│   │   └── ordens/                 # GET, POST, PATCH (conclusão repõe estoque de produto pronto)
│   │       └── [id]/etapas/[etapaId]/
│   │           └── condicoes/      # Registro de temperatura, umidade, observações
│   ├── layout.tsx                  # Layout raiz com SessionProvider
│   └── providers.tsx               # Client providers
├── components/
│   ├── Sidebar.tsx                 # Navegação lateral
│   └── Transcricao.tsx             # Conversa do WhatsApp em balões
├── lib/
│   ├── auth.ts                     # authOptions (NextAuth config)
│   ├── api-auth.ts                 # exigirSessao(role?) usado em todas as rotas de API
│   ├── estoque.ts                  # Baixa atômica de estoque (sem estoque negativo em acessos simultâneos)
│   ├── ordens.ts                   # Concluir/cancelar ordem (reposição e estorno de insumos)
│   ├── pedidos.ts                  # Criar/confirmar/entregar/cancelar pedidos
│   ├── whatsapp.ts                 # Envio, assinatura do webhook e fila por cliente
│   ├── chatbot/                    # Atendimento: fluxo guiado (fluxo.ts), IA plano B (agente.ts),
│   │                               # orquestração (atendimento.ts), prompt, ferramentas e avisos
│   └── prisma.ts                   # Singleton do PrismaClient
├── prisma/
│   ├── schema.prisma               # Models: User, Fornecedor, Categoria, Insumo, MovimentacaoEstoque
│   ├── migrations/                 # Histórico de migrations
│   └── seed.ts                     # Dados iniciais
├── ia/                           # Previsão de demanda em Python (ver ia/README.md)
│   ├── previsao/                 # Preparação, análise, modelos e CLI
│   └── tests/
├── types/
│   └── next-auth.d.ts              # Extensão de tipos (id, role na sessão)
├── middleware.ts                   # Proteção de rotas autenticadas
├── Caddyfile                       # Proxy HTTPS (perfil "https" do docker-compose)
├── docker-compose.yml
├── Dockerfile                      # Build multi-stage + Prisma Client para Alpine (musl)
├── docker-entrypoint.sh            # Aplica migrations automaticamente antes de iniciar o server
├── .dockerignore
└── .env.example
```

---

## 🗄️ Schema do banco de dados

```prisma
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
```

> **Atenção:** após clonar o repositório, execute `npx prisma migrate dev` para aplicar todas as migrations.

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
- [ ] Ajuste de hiperparâmetros e avaliação (MAE/RMSE/MAPE)
- [ ] Microsserviço FastAPI + scikit-learn com endpoint REST protegido por API key

### Sprint 7 — Integração (semanas 13–14)
- [ ] Integração do microsserviço com a aplicação principal
- [ ] Sugestão de produção semanal com intervalo de confiança
- [ ] Tela de comparação planejado x realizado

### Sprint 8 — Deploy e validação (semanas 15–16)
- [ ] Pipeline CI/CD (GitHub Actions)
- [ ] Deploy completo (app + IA) na VPS
- [ ] Testes finais com o parceiro e documentação final

---

## 🔗 Links úteis

- [Jira — Gerenciamento do projeto](https://diegoplanichek.atlassian.net)
- [Documentação da API](#) *(em breve)*
- [Ambiente de produção](#) *(em breve)*

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

## 👤 Autor

**Diego Planinscheck**  
Católica SC — Engenharia de Software, 2026  
[diego.planinscheck@catolicasc.edu.br](mailto:diego.planinscheck@catolicasc.edu.br)
