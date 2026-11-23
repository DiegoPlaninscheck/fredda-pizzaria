# Requisitos

Requisitos levantados com a pizzaria parceira e conferidos com o que está implementado. A coluna **Perfil** indica quem pode executar a ação: **Todos** = ADMIN e OPERADOR autenticados; **ADMIN** = só administradores; **Cliente** = cliente final pelo WhatsApp. As rotas citadas ficam em `app/api/`.

## Requisitos funcionais

### Autenticação e perfis
| ID | Requisito | Perfil |
|---|---|---|
| RF01 | O usuário entra com e-mail e senha; a sessão é um JWT (NextAuth) e as senhas são guardadas com bcrypt | Todos |
| RF02 | Todas as telas da área interna e todas as rotas de API exigem sessão válida (`middleware.ts` + `exigirSessao()` em `lib/api-auth.ts`) | Todos |
| RF03 | Excluir ou inativar categorias, fornecedores, insumos e receitas, cancelar vendas e retreinar o modelo de previsão são ações exclusivas do ADMIN | ADMIN |

### Insumos, fornecedores e categorias
| ID | Requisito | Perfil |
|---|---|---|
| RF04 | Cadastrar, editar, buscar e filtrar fornecedores, validando os dígitos verificadores do CNPJ | Todos (exclusão: ADMIN) |
| RF05 | Manter categorias de insumo com ativar/inativar | Todos (exclusão: ADMIN) |
| RF06 | Cadastrar insumos com unidade de medida, estoque mínimo, preço, categoria e fornecedor | Todos (exclusão: ADMIN) |
| RF07 | Registrar entradas de insumo com lote, validade, preço e fornecedor | Todos |
| RF08 | Registrar saídas de insumo, recusando saldo insuficiente | Todos |
| RF09 | Consultar o histórico de movimentações de cada insumo com saldo acumulado e exportar em CSV | Todos |
| RF10 | Alertar insumos abaixo do mínimo no dashboard e na navegação lateral | Todos |

### Receitas (fichas técnicas)
| ID | Requisito | Perfil |
|---|---|---|
| RF11 | Cadastrar receitas com ingredientes (insumo e quantidade), rendimento, descrição e preço de venda | Todos (inativação: ADMIN) |
| RF12 | Manter o estoque de produto pronto de cada receita (pizzas congeladas por sabor) | Sistema |

### Produção e fermentação
| ID | Requisito | Perfil |
|---|---|---|
| RF13 | Criar ordens de produção com uma ou mais receitas e data prevista, verificando o estoque de insumos necessário | Todos |
| RF14 | Ao criar a ordem, gerar as 5 etapas padrão: mistura (30 min), descanso inicial (1 h), fermentação longa (24 h), modelagem (1 h) e congelamento (12 h) | Sistema |
| RF15 | Iniciar, pausar e concluir cada etapa com timer; só uma etapa por vez fica em andamento | Todos |
| RF16 | Registrar temperatura, umidade e observações durante as etapas | Todos |
| RF17 | Ao criar a ordem, baixar os insumos. Ao concluir, repor o estoque de produto pronto de cada receita. Ao cancelar, estornar os insumos baixados | Sistema |
| RF18 | Painel de ordens com progresso e atualização automática | Todos |

### Vendas
| ID | Requisito | Perfil |
|---|---|---|
| RF19 | Registrar vendas com cliente, sabor, quantidade, forma de pagamento e dados de entrega, baixando o estoque de produto pronto | Todos |
| RF20 | Marcar venda como paga e/ou entregue | Todos |
| RF21 | Cancelar venda, estornando o estoque de produto pronto | ADMIN |
| RF22 | Listar vendas com filtros e exportar em CSV (base do histórico usado pela IA) | Todos |

### Pedidos pelo WhatsApp (chatbot)
| ID | Requisito | Perfil |
|---|---|---|
| RF23 | Receber mensagens do WhatsApp por webhook (Meta Cloud API ou Twilio), validando a assinatura de cada requisição | Sistema |
| RF24 | Conduzir o pedido por menu guiado: sabores (lista paginada), quantidade, carrinho, nome, retirada ou entrega, endereço, pagamento, resumo e confirmação | Cliente |
| RF25 | Quando o menu não entender a mensagem, responder com IA generativa usando o contexto do carrinho e as mesmas regras de negócio, sem nunca inventar informações | Cliente |
| RF26 | Mostrar ao cliente os próprios pedidos e permitir cancelar os que ainda aguardam confirmação | Cliente |
| RF27 | Criar o pedido como "Aguardando confirmação", reservando o estoque de produto pronto com o preço atual do cardápio | Sistema |
| RF28 | Painel de pedidos (atualizado a cada 15 s) com confirmar, entregar e cancelar. A confirmação gera as vendas e o cancelamento devolve o estoque | Todos |
| RF29 | Avisar o cliente pelo WhatsApp a cada mudança de status do pedido | Sistema |
| RF30 | Permitir que a equipe assuma a conversa, responda pelo painel e devolva o atendimento ao bot | Todos |
| RF31 | Simulador do WhatsApp no painel, que passa pelo mesmo atendimento sem enviar mensagens reais | Todos |

### Planejamento e previsão de demanda
| ID | Requisito | Perfil |
|---|---|---|
| RF32 | Prever a venda semanal de cada sabor com intervalo de 80%, usando o histórico de vendas | Sistema |
| RF33 | Sugerir a produção da semana: previsão (ou limite superior) menos o estoque projetado (estoque atual + ordens em andamento − demanda prevista até a semana) | Todos |
| RF34 | Ajustar e salvar o plano da semana e gerar a ordem de produção a partir dele | Todos |
| RF35 | Comparar planejado × produzido × vendido por semana, com erro médio da previsão e % de vendas dentro da faixa | Todos |
| RF36 | Retreinar o modelo com as vendas mais recentes | ADMIN |

### Dashboard e site público
| ID | Requisito | Perfil |
|---|---|---|
| RF37 | Dashboard com KPIs de vendas, produção, estoque e faturamento semanal em gráfico | Todos |
| RF38 | Página pública com o cardápio (receitas ativas com preço), modo de preparo, retirada e link para o WhatsApp | Público |

## Requisitos não funcionais

| ID | Categoria | Requisito | Como é atendido |
|---|---|---|---|
| RNF01 | Segurança | Comunicação só por HTTPS | Caddy com certificado Let's Encrypt; o app escuta só em `127.0.0.1` |
| RNF02 | Segurança | Webhooks aceitam apenas requisições do provedor | Validação de `X-Hub-Signature-256` (Meta) e `X-Twilio-Signature` |
| RNF03 | Segurança | Chaves de serviço nunca chegam ao navegador e falham fechadas | `IA_API_KEY` e `METRICS_TOKEN` só no servidor, comparadas em tempo constante; sem chave configurada, a rota recusa |
| RNF04 | Segurança | O cliente do chatbot só acessa os próprios dados | O cliente é identificado pelo telefone no servidor; nem o menu nem a IA escolhem de quem é o pedido; preços sempre recalculados do cardápio |
| RNF05 | Integridade | O estoque nunca fica negativo, mesmo com acessos simultâneos | Baixa atômica com `updateMany` condicional (`lib/estoque.ts`) e transições de status filtradas no próprio UPDATE |
| RNF06 | Disponibilidade | O sistema volta sozinho após reinício da VPS | `restart: unless-stopped` em todos os serviços; health check em `/api/health` |
| RNF07 | Observabilidade | Saúde e uso do sistema monitorados | Prometheus + Grafana com métricas técnicas e de negócio e regras de alerta ([Observabilidade](Observabilidade)) |
| RNF08 | Manutenibilidade | Toda mudança passa por build, lint, tipos, testes e análise estática | Pipeline CI/CD + SonarCloud + CodeQL ([Qualidade](Qualidade)) |
| RNF09 | Implantação | Deploy automatizado e reversível | Imagens versionadas por commit no GHCR, deploy pelo pipeline com backup prévio do banco ([Deploy](Deploy-e-Infraestrutura)) |
| RNF10 | Privacidade (LGPD) | Coletar só os dados necessários ao pedido | O chatbot guarda telefone, nome e endereço para entregar o pedido; a IA recebe só o contexto da conversa atual; os dados de vendas usados no treino ficam fora do Git (`ia/.gitignore`) |
| RNF11 | Usabilidade | Interface utilizável no celular | Layout responsivo com menu retrátil e tabelas com rolagem própria |
| RNF12 | Acessibilidade | Contraste e semântica adequados | Paleta com contraste alto (verde-escuro/creme), componentes de UI com rótulos e foco visível |
| RNF13 | Custo | Uso da IA generativa só quando necessário | A IA só responde mensagens fora do menu, com prompt caching e effort baixo |
