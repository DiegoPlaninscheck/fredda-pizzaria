# Observabilidade

O sistema é monitorado com **Prometheus** (coleta e alertas) e **Grafana** (dashboard), rodando na própria VPS no perfil `observabilidade` do Docker Compose. A configuração inteira é código, em [`observabilidade/`](https://github.com/DiegoPlaninscheck/fredda-pizzaria/tree/main/observabilidade).

- **Dashboard:** https://grafana.pizzafredda.com.br → pasta *Fredda* → **Fredda — Operação** (login de administrador)
- **Health check público:** https://pizzafredda.com.br/api/health

## O que é coletado

| Fonte | Endpoint | Métricas |
|---|---|---|
| App Next.js | `app:3000/api/metrics` (exige `Authorization: Bearer $METRICS_TOKEN`) | Runtime do Node (memória, heap, event loop, GC) com prefixo `fredda_node_` + métricas de negócio |
| Serviço de previsão | `ia:8000/metrics` (só na rede interna) | Requisições e latência HTTP por rota, previsões, treinos e modelo ativo |
| VPS | `node-exporter:9100` | CPU, memória, disco e rede |

### Métricas de negócio

| Métrica | Tipo | Significado | Onde é registrada |
|---|---|---|---|
| `fredda_pedidos_total{canal,status}` | counter | Pedidos criados e mudanças de status | `lib/pedidos.ts` |
| `fredda_pedidos_pendentes` | gauge | Pedidos aguardando confirmação (lido do banco na coleta) | `lib/metricas.ts` |
| `fredda_insumos_abaixo_minimo` | gauge | Insumos ativos abaixo do estoque mínimo | `lib/metricas.ts` |
| `fredda_chatbot_mensagens_total{origem}` | counter | Mensagens atendidas pelo `fluxo` (menu), pela `ia` ou com `fallback` (menu de novo) | `lib/chatbot/atendimento.ts` |
| `fredda_chatbot_ia_duracao_seconds` | histogram | Tempo de resposta da IA do chatbot | `lib/chatbot/agente.ts` |
| `fredda_chatbot_ia_erros_total{tipo}` | counter | Falhas da IA (`api` = erro da Anthropic, `interno`) | `lib/chatbot/agente.ts` |
| `fredda_previsao_requisicoes_total{rota,resultado}` | counter | Chamadas do app ao serviço de previsão (`ok`, `sem_resposta`, `http_5xx`…) | `lib/ia.ts` |
| `fredda_webhook_requisicoes_total{provedor,resultado}` | counter | Webhooks recebidos da Meta/Twilio (`aceito`, `assinatura_invalida`…) | rotas `app/api/whatsapp/*` |
| `fredda_ia_previsoes_total{modelo}` | counter | Previsões atendidas pelo serviço | `ia/servico/app.py` |
| `fredda_ia_treinos_total{resultado}` / `fredda_ia_treino_duracao_seconds` | counter / histogram | Treinos e sua duração | `ia/servico/app.py` |
| `fredda_ia_modelo_info{modelo_ativo,treinado_em}` | info | Modelo carregado (baseline ou gradient boosting) | `ia/servico/app.py` |

Se o banco cair, os gauges ficam sem valor nesta coleta, mas o `/api/metrics` continua respondendo, e a queda aparece no `/api/health`.

## Dashboard "Fredda — Operação"

| Linha | Painéis |
|---|---|
| Visão geral | App no ar · IA no ar · Alertas ativos · Pedidos aguardando · Insumos abaixo do mínimo · Modelo de previsão ativo |
| Pedidos e atendimento | Pedidos por status · Mensagens do chatbot por origem (menu × IA) · Latência da IA (p50/p95) · Erros da IA e dos webhooks |
| Previsão de demanda | Chamadas ao serviço de previsão · Latência do serviço por rota · Treinamentos |
| Infraestrutura | CPU, memória e disco da VPS · Memória do Node · Event loop lag · Requisições ao serviço de IA por status |

O JSON do dashboard (`observabilidade/grafana/dashboards/fredda-operacao.json`) é provisionado no start do Grafana e não pode ser editado pela interface: mudanças passam por PR.

## Alertas

Regras em [`observabilidade/alertas.yml`](https://github.com/DiegoPlaninscheck/fredda-pizzaria/blob/main/observabilidade/alertas.yml), avaliadas pelo Prometheus a cada 30 s. Aparecem no painel **Alertas ativos** do dashboard.

| Alerta | Condição |
|---|---|
| `ServicoFora` | App, IA ou node-exporter sem responder à coleta por 2 min |
| `DiscoQuaseCheio` | Disco da VPS acima de 85% por 10 min |
| `MemoriaAlta` | Memória da VPS acima de 90% por 10 min |
| `ErrosNaIADoChatbot` | Mais de 3 falhas da IA em 15 min |
| `PrevisaoIndisponivel` | Falhas nas chamadas ao serviço de previsão nos últimos 30 min |
| `PedidosParados` | Pedido aguardando confirmação há mais de 30 min |

**Próximo passo:** enviar as notificações por e-mail (Alertmanager ou contact point do Grafana com SMTP).

## Logs

Os logs ficam no Docker com rotação (3 arquivos de 10 MB por container). O app registra com prefixos por área (`[chatbot]`, `[whatsapp]`), incluindo o uso de tokens de cada resposta da IA:

```bash
docker logs --tail 100 -f fredda_app
docker logs --tail 100 fredda_ia
```

## Rodar localmente

```bash
# no .env: METRICS_TOKEN e GRAFANA_ADMIN_PASSWORD
docker compose --profile observabilidade up -d --build
```

- Prometheus (targets e alertas): `docker compose exec prometheus wget -qO- localhost:9090/api/v1/targets`
- Grafana: http://localhost:3001 (usuário `admin`)

> No Docker Desktop (Windows/macOS), o node-exporter mede a VM do Docker, não a sua máquina.
