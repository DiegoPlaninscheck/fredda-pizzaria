# 🍕 Fredda Pizzaria — Sistema de Gestão

Sistema web de gestão operacional desenvolvido para pizzarias especializadas em massas de longa fermentação. Integra controle de estoque de insumos, acompanhamento do processo produtivo com rastreamento de fermentação e previsão de demanda baseada em inteligência artificial.

> Projeto de portfólio — Engenharia de Software, Católica SC, 2026  
> Autor: Diego Planinscheck

---

## 📋 Sobre o projeto

Pizzarias que trabalham com massas de longa fermentação (24–72 horas) enfrentam desafios operacionais específicos que sistemas genéricos de gestão não resolvem: controle preciso de insumos perecíveis, monitoramento de etapas de fermentação e planejamento de produção ajustado à demanda variável.

O **Fredda Pizzaria** é um sistema dedicado que resolve esses pontos com:

- Controle completo de estoque de insumos com rastreabilidade de lotes
- Ordens de produção com timer de fermentação por etapa
- Estoque de produto pronto por sabor, atualizado automaticamente por produção e vendas
- Registro de vendas com controle de pagamento e entrega
- Dashboard operacional com KPIs em tempo real
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
| **Previsão de demanda** | Modelo preditivo, sugestão de produção | 📅 Planejado |

---

## 🛠️ Stack tecnológico

| Camada | Tecnologia |
|--------|-----------|
| Frontend + Backend | [Next.js 14](https://nextjs.org/) (App Router) |
| ORM | [Prisma](https://www.prisma.io/) |
| Banco de dados | MySQL 8 |
| Autenticação | [NextAuth.js](https://next-auth.js.org/) v4 (Credentials + JWT) |
| Containerização | Docker + Docker Compose |
| IA / Previsão | Python (FastAPI + scikit-learn) |
| Hospedagem | VPS (DigitalOcean / Contabo) |
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

---

## 🐳 Rodar com Docker (ambiente completo)

```bash
docker compose up --build
```

---

## 📁 Estrutura do projeto

```
fredda-pizzaria/
├── app/
│   ├── (auth)/                     # Rotas públicas
│   │   └── login/                  # Página de login
│   ├── (dashboard)/                # Área autenticada (requer sessão)
│   │   ├── dashboard/              # Dashboard com KPIs reais
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
│   │   └── ordens/                 # GET, POST, PATCH (conclusão repõe estoque de produto pronto)
│   │       └── [id]/etapas/[etapaId]/
│   │           └── condicoes/      # Registro de temperatura, umidade, observações
│   ├── layout.tsx                  # Layout raiz com SessionProvider
│   └── providers.tsx               # Client providers
├── components/
│   └── Sidebar.tsx                 # Navegação lateral
├── lib/
│   ├── auth.ts                     # authOptions (NextAuth config)
│   └── prisma.ts                   # Singleton do PrismaClient
├── prisma/
│   ├── schema.prisma               # Models: User, Fornecedor, Categoria, Insumo, MovimentacaoEstoque
│   ├── migrations/                 # Histórico de migrations
│   └── seed.ts                     # Dados iniciais
├── types/
│   └── next-auth.d.ts              # Extensão de tipos (id, role na sessão)
├── middleware.ts                   # Proteção de rotas autenticadas
├── docker-compose.yml
├── Dockerfile
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
                       precoUnitario, motivo, insumoId, fornecedorId, usuarioId

Receita              — id, nome, descricao, rendimento (Decimal), estoqueAtual (Decimal, produto pronto), ativo
ReceitaInsumo        — id, receitaId, insumoId, quantidade (Decimal); unique(receitaId,insumoId)
OrdemProducao        — id, status (PLANEJADA|EM_ANDAMENTO|PAUSADA|CONCLUIDA|CANCELADA),
                       quantidade, dataPrevista, observacoes, receitaId, usuarioId
                       (ao concluir, incrementa Receita.estoqueAtual)
EtapaFermentacao     — id, nome (MISTURA|DESCANSO_INICIAL|FERMENTACAO_LONGA|MODELAGEM|CONGELAMENTO),
                       ordem, status (PENDENTE|EM_ANDAMENTO|PAUSADA|CONCLUIDA),
                       duracaoMinutos, minutosDecorridos, iniciadaEm, concluidaEm, ordemId
RegistroCondicoes    — id, temperatura, umidade, observacoes, createdAt, etapaId

Venda                — id, cliente, quantidade (Decimal), precoUnitario, valorTotal,
                       formaPagamento, pago, entregue, dataVenda, dataEntrega, observacoes,
                       receitaId, usuarioId (ao registrar, decrementa Receita.estoqueAtual)
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
- [x] Registro de entradas com número de lote e data de validade (geração automática de lote)
- [x] Registro de saídas com validação de saldo suficiente (impede estoque negativo)
- [x] Histórico de movimentações com filtros por tipo e período, saldo acumulado e exportação CSV
- [x] Alertas de estoque mínimo no dashboard, na listagem e badge na navegação lateral
- [x] Dashboard com KPIs reais (total de insumos, alertas, fornecedores ativos)

### Sprint 3 — Processo produtivo (semanas 5–6)
- [x] Fichas técnicas de receitas com ingredientes por unidade e rendimento por lote
- [x] CRUD de receitas com soft delete e vínculo com ordens
- [x] Ordens de produção com seleção de receita, quantidade e data prevista
- [x] Validação de estoque ao criar ordem (bloqueia com lista de insumos insuficientes)
- [x] 5 etapas de fermentação padrão criadas automaticamente por ordem (Mistura, Descanso, Fermentação longa, Modelagem, Congelamento)
- [x] Timer de fermentação por etapa com Iniciar / Pausar / Concluir (tempo acumulado persistido)
- [x] Registro de condições ambientais (temperatura, umidade, observações) por etapa
- [x] Painel de ordens com filtro por status, barra de progresso e atualização automática (15s)
- [x] Sidebar com navegação para Produção e Receitas

### Sprint 4 — Dados e planejamento (semanas 7–8)
- [x] Registro de vendas (cliente, forma de pagamento, status de pagamento e entrega)
- [x] Estoque de produto pronto por sabor (venda dá baixa, ordem concluída repõe)
- [x] Dashboard com KPIs de vendas (faturamento do mês, unidades vendidas, sabor mais vendido)
- [x] Exportação de histórico de vendas em CSV com filtros por receita e período
- [x] Importação de dados reais de vendas/receitas/insumos a partir de planilha histórica

### Sprint 5 — IA e entrega (semanas 9–10)
- [ ] Microservice Python com modelo preditivo
- [ ] Sugestão de produção semanal
- [ ] Testes finais com o parceiro
- [ ] Documentação final

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
