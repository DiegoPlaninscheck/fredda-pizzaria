from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DIR_DADOS = RAIZ / "dados"
DIR_MODELOS = RAIZ / "modelos"
DIR_RELATORIOS = RAIZ / "relatorios"

# Semanas de segunda a domingo (planejamento semanal de produção).
# Cada semana é identificada pela data da segunda-feira.
FREQ_SEMANAL = "W-SUN"

# Lags usados como features do modelo principal (em semanas)
LAGS = [1, 2, 3, 4, 8]
JANELAS_MEDIA = [4, 8]

# Mínimo de semanas de histórico de um sabor para usar o modelo principal;
# abaixo disso a previsão cai no baseline.
MIN_SEMANAS_MODELO = max(LAGS) + 4

# Semanas reservadas no final da série para validação (holdout)
SEMANAS_VALIDACAO = 8

# Ajuste de hiperparâmetros: validação cruzada temporal antes do holdout.
# Usa até DOBRAS_AJUSTE dobras de SEMANAS_DOBRA semanas, deixando sempre pelo menos
# MIN_SEMANAS_TREINO_DOBRA semanas de treino na primeira dobra.
DOBRAS_AJUSTE = 6
MIN_DOBRAS_AJUSTE = 2
SEMANAS_DOBRA = 4
MIN_SEMANAS_TREINO_DOBRA = 26

# Fuso da pizzaria: o banco guarda as datas em UTC e as semanas são contadas no horário local
FUSO = "America/Sao_Paulo"

# Nível do intervalo de previsão (80%: 10% de chance de vender abaixo do limite inferior
# e 10% acima do superior)
NIVEL_INTERVALO = 0.8
