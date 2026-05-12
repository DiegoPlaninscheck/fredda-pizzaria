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
- Dashboard operacional com KPIs em tempo real
- Previsão de demanda semanal com modelo de IA treinado com dados históricos

---

## 🧩 Módulos

| Módulo | Descrição | Status |
|--------|-----------|--------|
| **Autenticação** | Login, perfis de usuário | 🔄 Em desenvolvimento |
| **Estoque de insumos** | CRUD, entradas/saídas, alertas, lotes | 🔄 Em desenvolvimento |
| **Produtos** | Catálogo, fichas técnicas, estoque de congelados | 📅 Planejado |
| **Processo produtivo** | Ordens de produção, timer de fermentação | 📅 Planejado |
| **Previsão de demanda** | Modelo preditivo, sugestão de produção | 📅 Planejado |

---

## 🛠️ Stack tecnológico

| Camada | Tecnologia |
|--------|-----------|
| Frontend + Backend | [Next.js 14](https://nextjs.org/) (App Router) |
| ORM | [Prisma](https://www.prisma.io/) |
| Banco de dados | MySQL / MariaDB |
| Autenticação | [NextAuth.js](https://next-auth.js.org/) |
| Containerização | Docker + Docker Compose |
| IA / Previsão | Python (FastAPI + scikit-learn) |
| Hospedagem | VPS (DigitalOcean / Contabo) |
| CI/CD | GitHub Actions |

---

## 🚀 Como rodar localmente

### Pré-requisitos

- Node.js 20+
- Docker e Docker Compose
- MySQL 8+ (ou via Docker)

### 1. Clone o repositório

```bash
git clone https://github.com/<seu-usuario>/fredda-pizzaria.git
cd fredda-pizzaria
```

### 2. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env` com suas credenciais:

```env
DATABASE_URL="mysql://user:password@localhost:3306/fredda_pizzaria"
NEXTAUTH_SECRET="sua-chave-secreta"
NEXTAUTH_URL="http://localhost:3000"
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

---

## 🐳 Rodar com Docker (ambiente completo)

```bash
docker compose up --build
```

---

## 📁 Estrutura do projeto

```
fredda-pizzaria/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Rotas de autenticação
│   ├── (dashboard)/        # Área autenticada
│   │   ├── estoque/        # Módulo de estoque
│   │   ├── producao/       # Módulo de produção
│   │   └── relatorios/     # Relatórios e KPIs
│   └── api/                # API Routes (Next.js)
├── components/             # Componentes React reutilizáveis
├── lib/                    # Utilitários, Prisma client, helpers
├── prisma/
│   ├── schema.prisma       # Schema do banco de dados
│   ├── migrations/         # Histórico de migrations
│   └── seed.ts             # Dados iniciais
├── ai-service/             # Microservice Python (previsão de demanda)
│   ├── main.py             # FastAPI app
│   ├── model/              # Modelo preditivo
│   └── requirements.txt
├── public/                 # Assets estáticos
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

---

## 🗓️ Roadmap

### Sprint 1 — Fundação (semanas 1–2)
- [x] Setup do repositório e README
- [ ] Projeto Next.js + Prisma + MySQL
- [ ] Autenticação com NextAuth.js
- [ ] Cadastro de fornecedores e categorias
- [ ] Deploy inicial na VPS

### Sprint 2 — Estoque de insumos (semanas 3–4)
- [ ] CRUD de insumos
- [ ] Registro de entradas e saídas
- [ ] Rastreabilidade de lotes
- [ ] Alertas de estoque mínimo

### Sprint 3 — Processo produtivo (semanas 5–6)
- [ ] Ordens de produção
- [ ] Timer de fermentação por etapas
- [ ] Registro de temperatura e ambiente

### Sprint 4 — Dados e planejamento (semanas 7–8)
- [ ] Registro de vendas
- [ ] Dashboard com KPIs
- [ ] Exportação de dados históricos

### Sprint 5 — IA e entrega (semanas 9–10)
- [ ] Microservice Python com modelo preditivo
- [ ] Sugestão de produção semanal
- [ ] Testes finais com o parceiro
- [ ] Documentação final

---

## 🔗 Links úteis

- [Jira — Gerenciamento do projeto](#) *(em breve)*
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