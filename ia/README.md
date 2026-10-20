# Previsão de demanda (IA) — Sprint 5

Módulo Python que prevê quantas pizzas de cada sabor serão vendidas na próxima semana,
a partir do histórico de vendas do sistema. Nesta sprint ele roda pela linha de comando;
o microsserviço FastAPI e a integração com o painel vêm nas Sprints 6 e 7.

## Instalação

```bash
cd ia
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## Uso

```bash
# 1. Coleta e preparação dos dados (escolha uma fonte)
python -m previsao preparar --banco            # lê do MySQL usando DATABASE_URL do .env
python -m previsao preparar --csv vendas.csv   # CSV do botão "Exportar CSV" em Vendas
python -m previsao preparar --sintetico        # 2 anos de dados fictícios, só para testar

# 2. Análise exploratória → relatorios/analise_exploratoria.md + gráficos
python -m previsao analisar

# 3. Validação e treinamento → modelos/previsor.joblib + modelos/metadados.json
python -m previsao treinar

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

**Validação** (`previsao/avaliacao.py`): as últimas 8 semanas ficam de fora do treino e cada
uma é prevista com uma semana de antecedência. O comando `treinar` compara MAE, RMSE e WAPE
do baseline e do modelo principal e só ativa o principal se ele tiver MAE menor. O ajuste de
hiperparâmetros e o MAPE ficam para a Sprint 6.

Com os dados sintéticos (`--sintetico`), um resultado típico é:

```
baseline  MAE 3.08  RMSE 3.73  WAPE 31.0%
principal MAE 2.92  RMSE 3.51  WAPE 29.4%
```

Esses números servem só para validar o código: a avaliação real depende do histórico de
vendas da pizzaria.

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
│   └── avaliacao.py   # validação holdout e métricas
├── tests/
└── requirements.txt
```
