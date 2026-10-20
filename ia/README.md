# Previsão de demanda (IA)

Módulo Python que prevê quantas pizzas de cada sabor serão vendidas nas próximas semanas,
a partir do histórico de vendas do sistema. Roda pela linha de comando (preparação, análise
e treino) e como microsserviço FastAPI (Sprint 6), usado pela tela de Planejamento do app (Sprint 7).

## Instalação

```bash
cd ia
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt   # requirements.txt tem só o necessário para o serviço
```

## Uso

```bash
# 1. Coleta e preparação dos dados (escolha uma fonte)
python -m previsao preparar --banco            # lê do MySQL usando DATABASE_URL do .env
python -m previsao preparar --csv vendas.csv   # CSV do botão "Exportar CSV" em Vendas
python -m previsao preparar --sintetico        # 2 anos de dados fictícios, só para testar

# 2. Análise exploratória → relatorios/analise_exploratoria.md + gráficos
python -m previsao analisar

# 3. Ajuste, validação e treinamento → modelos/previsor.joblib, modelos/metadados.json
#    e relatorios/avaliacao.md (MAE/RMSE/MAPE/WAPE por sabor)
python -m previsao treinar                  # --iteracoes 20 | --sem-ajuste

# 4. Previsão das próximas semanas por sabor
python -m previsao prever --semanas 2

# Testes
python -m pytest
```

Para `--banco`, exporte a mesma `DATABASE_URL` da aplicação (o formato `mysql://` do Prisma
é convertido para o driver PyMySQL). As pastas `dados/`, `modelos/` e `relatorios/` são
geradas localmente e não vão para o Git, porque podem conter dados de clientes.

## Como funciona

**Preparação** (`previsao/dados.py`): as vendas (`data`, `sabor`, `quantidade`) são somadas
por sabor e por semana (segunda a domingo). Semanas sem venda entram com zero e a semana
corrente, ainda incompleta, fica de fora.

**Análise exploratória** (`previsao/analise.py`): estatísticas por sabor (média, variação,
semanas zeradas, tendência, autocorrelação com 1, 4 e 52 semanas), gráficos das séries, do
total semanal e do dia da semana, e a recomendação de abordagem com base no tamanho do histórico.

**Abordagem escolhida**

| Opção | Decisão |
|-------|---------|
| Baseline: média móvel das últimas 4 semanas | ✅ Fallback para sabores com menos de 12 semanas de histórico ou quando o modelo principal não supera o baseline |
| Gradient boosting global (`HistGradientBoostingRegressor`, perda Poisson) | ✅ Modelo principal |
| SARIMA / Prophet por sabor | ⏸️ Exigem 2+ anos por sabor para estimar a sazonalidade anual; reavaliados na Sprint 6 quando houver histórico |
| XGBoost | ⏸️ Equivalente ao gradient boosting do scikit-learn, sem ganho que justifique outra dependência |

O modelo principal é **um só para todos os sabores**: usa as vendas das semanas anteriores
(lags de 1, 2, 3, 4 e 8 semanas), médias móveis de 4 e 8 semanas, desvio recente, semana do
ano (sazonalidade), mês, idade do sabor e o próprio sabor. Assim, sabores com pouco histórico
aproveitam os padrões dos demais. Para prever mais de uma semana, a previsão de cada semana
alimenta a seguinte.

**Ajuste e avaliação** (`previsao/avaliacao.py`, Sprint 6):

1. As últimas 8 semanas ficam reservadas como *holdout* e não participam de nenhuma escolha.
2. Busca aleatória de hiperparâmetros (`learning_rate`, `max_iter`, `max_leaf_nodes`,
   `min_samples_leaf`, `l2_regularization`; 20 combinações por padrão, incluindo os valores
   padrão) com validação cruzada temporal de janela expansível: até 6 dobras de 4 semanas,
   cada uma prevista só com as semanas anteriores.
3. Com os melhores parâmetros, o modelo é treinado até o corte e prevê cada semana do holdout
   com uma semana de antecedência. O baseline é avaliado nas mesmas semanas.
4. O modelo principal só fica ativo se tiver MAE menor que o baseline. Depois disso ele é
   retreinado com todo o histórico.

Métricas: **MAE** (pizzas erradas por semana), **RMSE** (pune erros grandes), **MAPE**
(erro percentual, só em semanas com venda, porque divide pelo real) e **WAPE** (erro total
dividido pelo volume vendido, estável mesmo com semanas zeradas). Com histórico curto demais,
o ajuste e a validação são pulados e o serviço usa só o baseline.

Com os dados sintéticos (`--sintetico`), um resultado típico é:

```
baseline  MAE 3.08  RMSE 3.73  MAPE 49.1%  WAPE 31.0%
principal MAE 2.86  RMSE 3.53  MAPE 49.3%  WAPE 28.9%
```

Esses números servem só para validar o código: a avaliação real depende do histórico de
vendas da pizzaria.

**Intervalo de previsão** (Sprint 7): cada previsão vem com uma faixa de 80%. A largura é
`z × raiz(previsão) × raiz(semanas à frente)`, porque o erro de contagens cresce com a raiz do
volume e com a distância da previsão. Os valores de `z` são os quantis 10% e 90% dos erros
padronizados do método no holdout; sem validação (histórico curto), usa ±1,28 (aproximação
de Poisson).

## Microsserviço (FastAPI)

```bash
export IA_API_KEY=$(openssl rand -hex 32)
export DATABASE_URL="mysql://fredda:fredda123@localhost:3306/fredda_pizzaria"
uvicorn servico.app:app --port 8000      # documentação interativa em /docs
```

| Rota | Autenticação | O que faz |
|------|--------------|-----------|
| `GET /saude` | não | Status e modelo ativo (usado pelo healthcheck do Docker) |
| `GET /modelo` | `X-API-Key` | Metadados: data do treino, sabores, hiperparâmetros e métricas de validação |
| `POST /previsao` | `X-API-Key` | Previsão por sabor com intervalo de 80%. Corpo: `{"semanas": 1-8, "ate": "AAAA-MM-DD"?, "sabores": [...]?, "vendas": [...]?}` |
| `POST /treinar` | `X-API-Key` | Retreina com as vendas do banco e passa a usar o novo modelo. Corpo: `{"iteracoes": 20}` |

- Sem `vendas` no corpo, `/previsao` lê o histórico direto do MySQL (`DATABASE_URL`).
- `ate` corta o histórico nesse dia: a semana que o contém entra inteira e semanas sem venda até ela contam como zero. O app manda o domingo da última semana completa, e `semanas` conta a partir da semana seguinte.
- As datas do banco (UTC) são convertidas para o horário de Brasília antes de agrupar por semana.
- A chave é comparada em tempo constante. Sem `IA_API_KEY` configurada, as rotas protegidas
  respondem 503 (o serviço nunca fica aberto por esquecimento).
- Sem modelo salvo (primeira subida), o serviço responde só com o baseline até o primeiro `/treinar`.
- Apenas um treino roda por vez (um segundo pedido recebe 409).

Exemplo:

```bash
curl -X POST http://localhost:8000/previsao \
  -H "X-API-Key: $IA_API_KEY" -H "Content-Type: application/json" \
  -d '{"semanas": 2}'
```

```json
{
  "modelo_ativo": "hist_gradient_boosting_poisson",
  "nivel_confianca": 0.8,
  "treinado_em": "2026-10-20T10:11:25+00:00",
  "ultima_semana_historico": "2025-12-22",
  "previsoes": [
    {"semana": "2025-12-29", "sabor": "Calabresa", "previsao": 12.6,
     "limite_inferior": 7.9, "limite_superior": 17.8, "metodo": "hist_gradient_boosting_poisson"}
  ]
}
```

**Docker:** o `docker-compose.yml` da raiz sobe o serviço `ia` junto com o app. Ele só é
acessível pela rede interna (`http://ia:8000`), lê o mesmo MySQL e guarda o modelo no volume
`ia_modelos`. Defina `IA_API_KEY` no `.env` e treine o primeiro modelo com:

```bash
docker compose exec ia python -c "import urllib.request,os,json; r=urllib.request.Request('http://localhost:8000/treinar', data=b'{}', headers={'X-API-Key': os.environ['IA_API_KEY'], 'Content-Type': 'application/json'}); print(json.load(urllib.request.urlopen(r))['modelo_ativo'])"
```

## Estrutura

```
ia/
├── previsao/
│   ├── __main__.py    # CLI: preparar, analisar, treinar, prever
│   ├── config.py      # lags, janelas, semanas de validação
│   ├── dados.py       # coleta (MySQL/CSV) e séries semanais
│   ├── sinteticos.py  # gerador de vendas fictícias
│   ├── analise.py     # análise exploratória e recomendação
│   ├── features.py    # features do modelo global
│   ├── modelos.py     # baseline, modelo principal e Previsor (com fallback)
│   ├── avaliacao.py   # métricas, validação temporal e ajuste de hiperparâmetros
│   └── treino.py      # pipeline de treino usado pela CLI e pelo serviço
├── servico/
│   └── app.py         # microsserviço FastAPI
├── tests/
├── Dockerfile
├── requirements.txt       # dependências do serviço
└── requirements-dev.txt   # + análise (matplotlib) e testes
```
