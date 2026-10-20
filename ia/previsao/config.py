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
