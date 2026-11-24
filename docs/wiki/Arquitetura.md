# Arquitetura

A arquitetura segue o modelo [C4](https://c4model.com/) em três níveis: contexto, containers e componentes. Os diagramas usam Mermaid com a notação do C4 (pessoas, sistema, sistemas externos e containers).

**Estilo:** um **monólito modular** em Next.js (interface e API REST no mesmo deploy, com camadas separadas) e um **microsserviço Python** para a previsão de demanda, isolado porque usa outra linguagem, outro ciclo de vida (treino) e outra carga de trabalho. Os motivos estão nas [Decisões Técnicas](Decisoes-Tecnicas).

## Nível 1 — Contexto

```mermaid
flowchart TB
    classDef pessoa fill:#08427b,color:#fff,stroke:#052e56
    classDef sistema fill:#1168bd,color:#fff,stroke:#0b4884
    classDef externo fill:#999,color:#fff,stroke:#6b6b6b

    equipe["👤 Equipe da pizzaria<br/><i>Administrador e Operador</i><br/>Planeja, produz, vende e confirma pedidos"]:::pessoa
    cliente["👤 Cliente<br/>Compra pizzas congeladas pelo WhatsApp"]:::pessoa

    fredda["<b>Fredda Pizzaria</b><br/><i>Sistema de software</i><br/>Produção com fermentação, planejamento com IA,<br/>pedidos pelo WhatsApp e gestão da operação"]:::sistema

    whatsapp["WhatsApp<br/><i>Meta Cloud API / Twilio</i><br/>Entrega as mensagens"]:::externo
    claude["Claude API<br/><i>Anthropic</i><br/>IA generativa do atendimento"]:::externo
    github["GitHub<br/><i>Actions + GHCR</i><br/>Build, testes e imagens"]:::externo

    equipe -- "Usa pelo navegador<br/>(HTTPS)" --> fredda
    cliente -- "Conversa" --> whatsapp
    whatsapp -- "Webhook assinado<br/>(HTTPS)" --> fredda
    fredda -- "Envia respostas e avisos<br/>(REST)" --> whatsapp
    fredda -- "Mensagens fora do menu<br/>(REST)" --> claude
    github -- "Entrega novas versões<br/>(runner na VPS)" --> fredda
```

## Nível 2 — Containers

Tudo roda em Docker Compose numa VPS (Hostinger, Ubuntu 24.04). Só o Caddy fica exposto na internet.

```mermaid
flowchart TB
    classDef pessoa fill:#08427b,color:#fff,stroke:#052e56
    classDef container fill:#438dd5,color:#fff,stroke:#2e6295
    classDef banco fill:#438dd5,color:#fff,stroke:#2e6295
    classDef externo fill:#999,color:#fff,stroke:#6b6b6b
    classDef obs fill:#85bbf0,color:#000,stroke:#5d82a8

    equipe["👤 Equipe"]:::pessoa
    whatsapp["WhatsApp<br/>(Meta/Twilio)"]:::externo
    claude["Claude API"]:::externo
    gh["GitHub Actions + GHCR"]:::externo

    subgraph VPS["VPS — Docker Compose (projeto fredda-pizzaria)"]
        caddy["<b>Caddy</b><br/><i>Proxy reverso</i><br/>HTTPS automático (Let's Encrypt)"]:::container
        app["<b>App web</b><br/><i>Next.js 14, TypeScript</i><br/>Interface React (App Router) +<br/>API REST + atendimento do chatbot"]:::container
        ia["<b>Serviço de previsão</b><br/><i>Python 3.12, FastAPI, scikit-learn</i><br/>Previsão semanal por sabor e treino"]:::container
        db[("<b>Banco de dados</b><br/><i>MySQL 8</i><br/>Cadastros, produção, vendas,<br/>pedidos e conversas")]:::banco
        prom["<b>Prometheus</b><br/>Coleta métricas e avalia alertas"]:::obs
        graf["<b>Grafana</b><br/>Dashboard de operação"]:::obs
        nodeexp["node-exporter<br/>Métricas da VPS"]:::obs
        runner["Runner GitHub Actions<br/><i>serviço do host</i><br/>Executa o deploy"]:::obs
    end

    equipe -- "HTTPS" --> caddy
    whatsapp -- "HTTPS (webhook)" --> caddy
    caddy -- "HTTP :3000" --> app
    caddy -- "HTTP :3001 (grafana.)" --> graf
    app -- "Prisma (TCP 3306)" --> db
    app -- "REST + X-API-Key" --> ia
    ia -- "SQLAlchemy (leitura de vendas)" --> db
    app -- "REST" --> claude
    app -- "REST" --> whatsapp
    prom -- "/api/metrics (Bearer)" --> app
    prom -- "/metrics" --> ia
    prom --> nodeexp
    graf --> prom
    runner -- "busca jobs (saída HTTPS)" --> gh
    runner -- "docker compose pull/up" --> app
```

| Container | Tecnologia | Responsabilidade | Exposição |
|---|---|---|---|
| Caddy | Caddy 2 (host) | Termina o TLS de `pizzafredda.com.br` e `grafana.pizzafredda.com.br` | 80/443 públicas |
| App web | Next.js 14 (Node 24) | Interface, API REST, autenticação, webhooks e chatbot | `127.0.0.1:3000` |
| Serviço de previsão | FastAPI + scikit-learn | `/previsao`, `/treinar`, `/modelo`, `/saude`, `/metrics` | só na rede interna |
| Banco | MySQL 8 | Persistência (volume `mysql_data`) | só na rede interna |
| Prometheus | Prometheus 2.55 | Coleta a cada 30 s, retenção de 15 dias, regras de alerta | só na rede interna |
| Grafana | Grafana 11 | Dashboard provisionado pelo repositório | `127.0.0.1:3001`, com login |
| node-exporter | node-exporter 1.8 | CPU, memória, disco e rede da VPS | só na rede interna |

## Nível 3 — Componentes do app web

O código do app é dividido em camadas: as **páginas** (`app/(dashboard)`) só falam com a **API** (`app/api`), que valida a entrada e a sessão e delega a regra de negócio aos **serviços de domínio** em `lib/`. Os serviços são os únicos que acessam o banco pelo Prisma.

```mermaid
flowchart TB
    classDef ui fill:#85bbf0,color:#000,stroke:#5d82a8
    classDef api fill:#438dd5,color:#fff,stroke:#2e6295
    classDef dom fill:#1168bd,color:#fff,stroke:#0b4884
    classDef ext fill:#999,color:#fff,stroke:#6b6b6b

    subgraph UI["Páginas — app/(dashboard), app/page.tsx"]
        pg["Dashboard · Produção · Receitas · Estoque ·<br/>Vendas · Pedidos · Planejamento · Simulador"]:::ui
        comp["components/ui (Button, Card, Toast, ConfirmDialog…)"]:::ui
    end

    subgraph API["Rotas de API — app/api"]
        rcrud["CRUD: insumos, fornecedores, categorias,<br/>receitas, vendas, ordens/etapas"]:::api
        rped["pedidos · conversas · chatbot/simulador"]:::api
        rwh["whatsapp/webhook · whatsapp/twilio<br/>(validação de assinatura)"]:::api
        rplan["planejamento · sugestao · comparacao · modelo"]:::api
        rops["health · metrics"]:::api
        auth["lib/api-auth — exigirSessao(role?)<br/>lib/auth — NextAuth (JWT)"]:::api
    end

    subgraph DOM["Serviços de domínio — lib/"]
        estoque["estoque.ts<br/>baixa/reposição atômica"]:::dom
        ordens["ordens.ts<br/>concluir/cancelar ordem"]:::dom
        pedidos["pedidos.ts<br/>criar/confirmar/entregar/cancelar"]:::dom
        plan["planejamento.ts + semanas.ts<br/>sugestão e planejado × realizado"]:::dom
        iacli["ia.ts<br/>cliente do serviço de previsão"]:::dom
        subgraph BOT["chatbot/"]
            atend["atendimento.ts<br/>orquestra menu × IA"]:::dom
            fluxo["fluxo.ts<br/>menu guiado (máquina de estados)"]:::dom
            agente["agente.ts + ferramentas.ts + prompt.ts<br/>IA plano B com ferramentas"]:::dom
            conv["conversas.ts · mensagens.ts · notificar.ts"]:::dom
        end
        canal["whatsapp.ts · twilio.ts<br/>envio, assinatura, fila por cliente"]:::dom
        metr["metricas.ts<br/>Prometheus (prom-client)"]:::dom
        prisma["prisma.ts — PrismaClient"]:::dom
    end

    claude["Claude API"]:::ext
    wa["WhatsApp"]:::ext
    iasvc["Serviço de previsão"]:::ext
    db[("MySQL")]:::ext

    pg --> rcrud & rped & rplan
    rcrud & rped & rplan --> auth
    rcrud --> estoque & ordens
    rped --> pedidos & conv & atend
    rwh --> canal & atend
    rplan --> plan --> iacli --> iasvc
    atend --> fluxo & agente & conv
    fluxo --> pedidos
    agente --> claude
    agente --> pedidos
    pedidos --> estoque
    conv --> canal --> wa
    estoque & ordens & pedidos & plan & conv --> prisma --> db
    rops --> metr & prisma
```

### Padrões aplicados

| Padrão | Onde | Por quê |
|---|---|---|
| **Camadas** (UI → API → domínio → dados) | `app/(dashboard)` → `app/api` → `lib/` → Prisma | Regras de negócio testáveis e reutilizadas pela UI, pelo chatbot e pela IA |
| **Singleton** | `lib/prisma.ts`, `lib/metricas.ts` | Uma conexão/registry por processo, mesmo com o hot reload do `next dev` |
| **Máquina de estados** | `lib/chatbot/fluxo.ts`, status de pedido e de ordem | Transições explícitas, validadas no próprio UPDATE (sem condição de corrida) |
| **Strategy / Adapter** | `lib/whatsapp.ts` × `lib/twilio.ts` | O mesmo atendimento serve à Meta e à Twilio, escolhidos por `WHATSAPP_PROVEDOR` |
| **Chain of responsibility (fallback)** | menu → IA → menu de novo; modelo principal → baseline | O sistema degrada com elegância quando um componente falha |
| **Tool use (function calling)** | `lib/chatbot/ferramentas.ts` | A IA usa as mesmas regras de negócio do menu, sem acesso direto ao banco |
| **Fila por chave** | `enfileirar()` em `lib/whatsapp.ts` | Processa as mensagens de cada cliente em ordem, sem bloquear os demais |

## Fluxo de uma requisição autenticada

1. O navegador chama `/api/...` com o cookie da sessão (JWT do NextAuth).
2. A rota chama `exigirSessao()` ou `exigirSessao('ADMIN')`, que devolve 401/403 se for o caso.
3. A rota valida a entrada e chama o serviço de domínio em `lib/`.
4. O serviço executa a regra numa transação Prisma (ex.: baixa atômica de estoque) e devolve o resultado.
5. A rota responde em JSON; a página mostra o resultado com `Toast` ou `ConfirmDialog`.
