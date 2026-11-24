# Decisões Técnicas (ADRs)

Registro das principais decisões de arquitetura, no formato *Architecture Decision Record*: contexto, decisão e consequências. Uma decisão nova que substitui outra ganha um ADR próprio e marca a anterior como substituída.

| # | Decisão | Status |
|---|---|---|
| [001](#adr-001--nextjs-full-stack-monólito-modular) | Next.js full-stack (monólito modular) | Aceita |
| [002](#adr-002--mysql--prisma) | MySQL + Prisma | Aceita |
| [003](#adr-003--previsão-de-demanda-em-microsserviço-python) | Previsão de demanda em microsserviço Python | Aceita |
| [004](#adr-004--gradient-boosting-global-com-baseline-de-fallback) | Gradient boosting global com baseline de fallback | Aceita |
| [005](#adr-005--chatbot-menu-guiado-com-ia-como-plano-b) | Chatbot: menu guiado com IA como plano B | Aceita |
| [006](#adr-006--claude-sonnet-55-com-effort-baixo-e-prompt-caching) | Claude Sonnet 5.5 com effort baixo e prompt caching | Aceita |
| [007](#adr-007--twilio-sandbox-como-alternativa-à-meta) | Twilio Sandbox como alternativa à Meta | Aceita |
| [008](#adr-008--estoque-atômico-com-updatemany-condicional) | Estoque atômico com `updateMany` condicional | Aceita |
| [009](#adr-009--vps-com-docker-compose-em-vez-de-paas) | VPS com Docker Compose em vez de PaaS | Aceita |
| [010](#adr-010--deploy-por-runner-self-hosted-e-imagens-no-ghcr) | Deploy por runner self-hosted e imagens no GHCR | Aceita |
| [011](#adr-011--observabilidade-com-prometheus--grafana) | Observabilidade com Prometheus + Grafana | Aceita |
| [012](#adr-012--análise-estática-com-sonarcloud--codeql) | Análise estática com SonarCloud + CodeQL | Aceita |
| [013](#adr-013--documentação-versionada-publicada-na-wiki) | Documentação versionada, publicada na Wiki | Aceita |
| [014](#adr-014--testes-com-vitest-contra-mysql-real-mocks-só-nas-fronteiras) | Testes com Vitest contra MySQL real, mocks só nas fronteiras | Aceita |

---

### ADR-001 — Next.js full-stack (monólito modular)
**Contexto.** Projeto individual, com prazo de dois semestres, interface rica e uma API usada só por essa interface e pelo chatbot.
**Decisão.** Next.js 14 (App Router, TypeScript) com interface e API REST no mesmo projeto, separadas em camadas: páginas → rotas de API → serviços de domínio em `lib/` → Prisma.
**Consequências.** Um só build, deploy e pipeline; tipos compartilhados de ponta a ponta. Em troca, a escala horizontal exige cuidado com o estado em memória (a fila do WhatsApp — ver ADR-010). A separação em `lib/` permite extrair um serviço no futuro sem reescrever regras.

### ADR-002 — MySQL + Prisma
**Contexto.** Os dados são fortemente relacionais (ficha técnica, ordem, venda, pedido) e exigem transações para manter o estoque consistente. As regras vetam banco em arquivo (SQLite/H2).
**Decisão.** MySQL 8 em container, acessado pelo Prisma ORM, com migrations versionadas em `prisma/migrations/`.
**Consequências.** Tipos gerados a partir do schema, migrations aplicadas automaticamente no start do container (`docker-entrypoint.sh`). Consultas que comparam duas colunas usam *field references* do Prisma.

### ADR-003 — Previsão de demanda em microsserviço Python
**Contexto.** O ecossistema de ciência de dados (pandas, scikit-learn) é Python; o treino é pesado e eventual; a previsão precisa ser chamada pelo app.
**Decisão.** Microsserviço FastAPI na pasta `ia/`, acessível só pela rede interna do compose, protegido por `X-API-Key` com comparação em tempo constante e falha fechada (sem chave configurada, recusa).
**Consequências.** O app continua funcionando se o serviço cair (o planejamento é feito à mão). Um container a mais na VPS. O modelo fica num volume (`ia_modelos`) e sobrevive a novos deploys.

### ADR-004 — Gradient boosting global com baseline de fallback
**Contexto.** O histórico de vendas é curto e alguns sabores são novos. SARIMA/Prophet por sabor precisam de 2+ anos para estimar a sazonalidade anual.
**Decisão.** Um único `HistGradientBoostingRegressor` (perda Poisson) para todos os sabores, com lags, médias móveis e calendário, ajustado por busca aleatória com validação cruzada temporal. O modelo só fica ativo se tiver MAE menor que o baseline (média móvel de 4 semanas) no holdout das últimas 8 semanas; sabores com menos de 12 semanas usam o baseline.
**Consequências.** Sabores novos aproveitam o padrão dos demais; a decisão de usar ou não o modelo é objetiva e reproduzível. Com o histórico atual, o modelo principal ainda não superou o baseline em produção — o sistema usa o baseline e mostra isso no dashboard. Detalhes em [`ia/README.md`](https://github.com/DiegoPlaninscheck/fredda-pizzaria/blob/main/ia/README.md).

### ADR-005 — Chatbot: menu guiado com IA como plano B
**Contexto.** O pedido segue sempre o mesmo roteiro (sabor, quantidade, entrega, pagamento). Um agente de IA conduzindo tudo seria mais lento, mais caro e menos previsível.
**Decisão.** Máquina de estados com botões e listas do WhatsApp (`lib/chatbot/fluxo.ts`). A IA só entra quando o cliente escreve algo que o menu não entende, recebe a etapa e o carrinho e usa as mesmas regras de negócio por *tool use* (`lib/chatbot/ferramentas.ts`).
**Consequências.** A maior parte das mensagens custa zero e responde na hora; sem chave da Anthropic o atendimento continua só com o menu. O cliente é identificado no servidor, então nem o menu nem a IA escolhem de quem é o pedido.

### ADR-006 — Claude Sonnet 5.5 com effort baixo e prompt caching
**Contexto.** As respostas da IA são curtas e guiadas por ferramentas; o custo por conversa importa para uma pizzaria pequena.
**Decisão.** `claude-sonnet-5-5` com `effort: low`, system prompt estático com cache (`cache_control`) e *fallback* automático de modelo em caso de recusa.
**Consequências.** Custo abaixo de US$ 0,01–0,03 por pedido conversado. O prompt não pode conter dados variáveis (data, nome), que vão num bloco `<contexto>` na mensagem.

### ADR-007 — Twilio Sandbox como alternativa à Meta
**Contexto.** Para responder clientes, a Meta exige verificação da empresa (CNPJ), ainda pendente com o parceiro.
**Decisão.** Adaptador para o WhatsApp Sandbox da Twilio (`lib/twilio.ts`, rota `/api/whatsapp/twilio`), escolhido por `WHATSAPP_PROVEDOR`. Sem botões no sandbox, as opções viram uma lista numerada.
**Consequências.** O mesmo atendimento serve aos dois provedores. A troca para a Meta é só configuração, quando a verificação sair.

### ADR-008 — Estoque atômico com `updateMany` condicional
**Contexto.** Vendas, pedidos do WhatsApp e ordens de produção podem baixar o mesmo estoque ao mesmo tempo. Ler, calcular e gravar causaria estoque negativo.
**Decisão.** Toda baixa usa `updateMany({ where: { id, estoqueAtual: { gte: qtd } }, data: { decrement: qtd } })` dentro da transação; se nenhuma linha muda, a operação é desfeita (`lib/estoque.ts`). Transições de status seguem a mesma ideia.
**Consequências.** Consistência sem locks explícitos nem nível de isolamento especial.

### ADR-009 — VPS com Docker Compose em vez de PaaS
**Contexto.** As regras do Portfólio vetam plataformas que escondem a infraestrutura (Vercel, Netlify, Render) e pedem domínio técnico do ambiente.
**Decisão.** VPS Hostinger (Ubuntu 24.04) com Docker Compose e Caddy no host para HTTPS automático. O app e o Grafana escutam só em `127.0.0.1`; o MySQL e a IA ficam só na rede interna.
**Consequências.** Controle total e custo fixo baixo. Em troca, backups, atualizações do sistema e monitoramento são responsabilidade do projeto (ver ADRs 010 e 011).

### ADR-010 — Deploy por runner self-hosted e imagens no GHCR
**Contexto.** O deploy era manual (`git pull` + build pelo console da VPS), o que as regras proíbem, e o build de ~5 min consumia a CPU da VPS em produção.
**Decisão.** O GitHub Actions builda as imagens e as publica no GHCR, marcadas pelo commit. Um runner self-hosted instalado na VPS (label `producao`, usuário `github-runner`) executa o job de deploy: backup do banco → `docker compose pull` → `up -d` → smoke test em `/api/health`.
**Alternativas.** Deploy por SSH a partir do Actions (exigiria abrir SSH e guardar a chave no GitHub, e pode ser confundido com o "deploy via SSH" vetado); polling de imagens na VPS (sem feedback no pipeline).
**Consequências.** Nenhuma porta de entrada nova e nenhuma credencial da VPS no GitHub; rollback = rodar de novo o deploy de um commit anterior. Riscos: o usuário do runner está no grupo `docker` (equivale a root na VPS), e o repositório é público. Mitigações: o job de deploy só roda em push na `main`, com `environment: production`; PRs de colaboradores externos exigem aprovação manual antes de rodar qualquer workflow.

### ADR-011 — Observabilidade com Prometheus + Grafana
**Contexto.** É preciso saber se o sistema está no ar, se a IA está falhando e como está a operação, sem pagar um SaaS e sem estourar a memória da VPS (KVM 1).
**Decisão.** Prometheus (retenção de 15 dias/1 GB, 256 MB), Grafana (192 MB) e node-exporter no perfil `observabilidade` do compose. O app expõe métricas técnicas e de negócio em `/api/metrics` (protegida por token), e o serviço de IA em `/metrics`. Dashboard, datasource e regras de alerta ficam versionados em `observabilidade/`.
**Consequências.** A configuração é código: a mesma em qualquer ambiente. Os alertas aparecem no Prometheus e no dashboard; ainda não há notificação por e-mail (falta configurar SMTP).

### ADR-012 — Análise estática com SonarCloud + CodeQL
**Contexto.** O núcleo comum exige análise estática de código e de segurança.
**Decisão.** SonarCloud (qualidade, code smells, duplicação e cobertura importada do pytest) no job `sonar` do CI, e CodeQL (SAST) para TypeScript e Python em PRs, na `main` e semanalmente. Dependabot abre PRs de atualização.
**Consequências.** Problemas aparecem no PR antes do merge. O gate do Sonar é informativo; quem bloqueia por cobertura é o Vitest no job `web` (ADR-014).

### ADR-013 — Documentação versionada, publicada na Wiki
**Contexto.** As regras pedem documentação na Wiki do repositório; editar só pela interface da Wiki tira a documentação do fluxo de revisão.
**Decisão.** As páginas ficam em `docs/wiki/` no repositório, passam por PR como o código e são publicadas na Wiki pelo job `wiki` do pipeline. Diagramas em Mermaid, renderizados pelo próprio GitHub.
**Consequências.** Documentação e código mudam juntos, no mesmo PR. Edições feitas direto na Wiki são sobrescritas no próximo push.

### ADR-014 — Testes com Vitest contra MySQL real, mocks só nas fronteiras
**Contexto.** A linha Web Apps exige TDD e 75%/25% de cobertura. Quase toda regra de negócio está em transações do Prisma (baixa atômica de estoque, transições de status filtradas no UPDATE), que um Prisma simulado não consegue provar.
**Decisão.** Vitest com dois projetos: backend (Node) contra um banco MySQL `fredda_test` com as migrations reais, executado em série; frontend (jsdom) com Testing Library. Só as fronteiras externas são simuladas: `fetch` (WhatsApp, Twilio, serviço de IA), SDK da Anthropic e sessão do NextAuth. Os limites de cobertura ficam em `vitest.config.mts` e falham o CI.
**Alternativas.** Prisma mockado (`vitest-mock-extended`): mais rápido e sem Docker, mas verifica chamadas em vez de resultados e quebra a cada refatoração. Jest: mais lento e com configuração extra para ESM/TypeScript.
**Consequências.** A suíte roda em cerca de 1 minuto e precisa de um MySQL (Docker local; serviço no GitHub Actions). Em troca, testa o comportamento real, inclusive concorrência, e já encontrou seis bugs (ver [Qualidade](Qualidade#tdd-e-bugs-encontrados)). O setup recusa rodar em banco sem o sufixo `_test`.
