# Fredda Pizzaria — Wiki

Sistema web que apoia a operação de uma pizzaria de **massas de longa fermentação** (24–72 h) que vende pizzas prontas e congeladas. Projeto de Portfólio de Engenharia de Software da Católica SC (2026), desenvolvido com um parceiro real: a Fredda Pizzaria, de Jaraguá do Sul/SC.

- **Produção:** https://pizzafredda.com.br
- **Código:** [repositório no GitHub](https://github.com/DiegoPlaninscheck/fredda-pizzaria)
- **Observabilidade:** https://grafana.pizzafredda.com.br (acesso com login)

## O problema

Na longa fermentação, a pizza de sábado começa a ser feita na quarta. Por isso, a pizzaria precisa decidir **quanto produzir de cada sabor dias antes de saber quanto vai vender**, acompanhar cada lote por etapas que duram horas (mistura, descanso, fermentação longa, modelagem e congelamento) e atender pedidos que chegam pelo WhatsApp a qualquer hora. Sistemas genéricos de gestão não cobrem nenhuma dessas três coisas: tratam a produção como instantânea, não preveem a demanda por sabor e não conversam com o cliente.

## A solução

| Pilar | O que o sistema faz |
|---|---|
| **Processo de fermentação** | Ordens de produção com várias receitas, etapas de fermentação com timer (iniciar/pausar/concluir), registro de temperatura e umidade e baixa/reposição automática de insumos e de produto pronto |
| **Planejamento com IA** | Microsserviço Python com modelo de *gradient boosting* treinado no histórico de vendas. Ele prevê a demanda semanal por sabor com intervalo de 80%, sugere quanto produzir considerando o estoque projetado e compara o planejado com o realizado |
| **Pedidos pelo WhatsApp** | Atendimento por menu guiado, com a IA generativa (Claude) como plano B quando o cliente sai do roteiro. O pedido entra no painel com o estoque reservado e a equipe confirma |
| **Apoio à operação** | Fichas técnicas, insumos e fornecedores, vendas, dashboard com KPIs e perfis de acesso (ADMIN/OPERADOR) |

## Páginas

| Página | Conteúdo |
|---|---|
| [Requisitos](Requisitos) | Requisitos funcionais e não funcionais |
| [User Stories](User-Stories) | Histórias de usuário por persona, com critérios de aceite |
| [Casos de Uso](Casos-de-Uso) | Os fluxos de negócio completos, com diagramas |
| [Arquitetura](Arquitetura) | Diagramas C4 (contexto, containers e componentes) |
| [Modelo de Dados](Modelo-de-Dados) | Diagrama entidade-relacionamento |
| [Decisões Técnicas](Decisoes-Tecnicas) | Registro de decisões de arquitetura (ADRs) |
| [Deploy e Infraestrutura](Deploy-e-Infraestrutura) | Pipeline CI/CD, ambientes, VPS, backups e rollback |
| [Observabilidade](Observabilidade) | Métricas, dashboard e alertas |
| [Qualidade](Qualidade) | CI, análise estática (SonarCloud, CodeQL) e testes |
| [Como Contribuir](Como-Contribuir) | Ambiente local, fluxo de branches e PRs |

## Stack

Next.js 14 (App Router, TypeScript) · Prisma + MySQL 8 · NextAuth (JWT) · Python 3.12 (FastAPI + scikit-learn) · Claude API · WhatsApp (Meta Cloud API / Twilio) · Docker Compose · Caddy · GitHub Actions + GHCR · SonarCloud + CodeQL · Prometheus + Grafana · VPS Hostinger.

> Esta Wiki é gerada a partir da pasta `docs/wiki/` do repositório e publicada pelo pipeline a cada push na `main`. Para corrigir uma página, edite o arquivo por PR, não pela interface da Wiki.
