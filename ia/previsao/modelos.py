"""Baseline (fallback) e modelo principal de previsão semanal por sabor.

- Baseline: média móvel das últimas 4 semanas do sabor. Simples, robusto e usado
  sempre que o sabor tem pouco histórico ou o modelo principal não supera o baseline.
- Principal: um único ``HistGradientBoostingRegressor`` (perda Poisson, adequada a
  contagens) treinado com todos os sabores juntos, usando lags, médias móveis,
  sazonalidade anual e o sabor como features.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

from .config import MIN_SEMANAS_MODELO, NIVEL_INTERVALO
from .features import adicionar_features, matriz

JANELA_BASELINE = 4

# Quantis da normal padrão para o intervalo de 80%, usados quando não há validação para
# calibrar (aproximação de Poisson: desvio ≈ raiz da média)
Z_PADRAO = {"z_inf": -1.2816, "z_sup": 1.2816}


def escala_residuo(previsao):
    """Escala dos erros de contagens: cresce com a raiz da previsão (mínimo 1)."""
    return np.sqrt(np.maximum(np.asarray(previsao, dtype=float), 1.0))


def intervalo(previsao: float, passo: int, z: dict) -> tuple[float, float]:
    """Intervalo de previsão a partir dos quantis dos resíduos padronizados.

    O erro de previsões mais distantes cresce com a raiz do número de semanas à frente.
    """
    escala = float(escala_residuo(previsao)) * np.sqrt(passo)
    inferior = max(0.0, previsao + z["z_inf"] * escala)
    superior = max(inferior, previsao + z["z_sup"] * escala)
    return round(inferior, 2), round(superior, 2)


class BaselineMediaMovel:
    nome = "baseline_media_movel_4"

    def __init__(self, janela: int = JANELA_BASELINE):
        self.janela = janela

    def prever_serie(self, historico: pd.Series, horizonte: int = 1) -> np.ndarray:
        if historico.empty:
            return np.zeros(horizonte)
        media = float(historico.tail(self.janela).mean())
        return np.full(horizonte, media)


# Hiperparâmetros padrão; a Sprint 6 os ajusta por validação temporal (avaliacao.ajustar)
PARAMS_PADRAO = {
    "learning_rate": 0.05,
    "max_iter": 300,
    "max_leaf_nodes": 15,
    "min_samples_leaf": 10,
    "l2_regularization": 1.0,
}


@dataclass
class ModeloPrincipal:
    params: dict = field(default_factory=lambda: dict(PARAMS_PADRAO))
    sabores: list[str] = field(default_factory=list)
    estimador: HistGradientBoostingRegressor | None = None
    nome: str = "hist_gradient_boosting_poisson"

    def novo_estimador(self, semente: int = 42) -> HistGradientBoostingRegressor:
        return HistGradientBoostingRegressor(loss="poisson", random_state=semente,
                                             **{**PARAMS_PADRAO, **self.params})

    def treinar(self, series: pd.DataFrame) -> "ModeloPrincipal":
        self.sabores = sorted(series["sabor"].unique())
        df = adicionar_features(series)
        df = df[df["lag_1"].notna()]
        if df.empty:
            raise ValueError("Histórico insuficiente para treinar o modelo principal.")
        self.estimador = self.novo_estimador()
        self.estimador.fit(matriz(df, self.sabores), df["quantidade"])
        return self

    def prever_linhas(self, df_features: pd.DataFrame) -> np.ndarray:
        prev = self.estimador.predict(matriz(df_features, self.sabores))
        return np.clip(prev, 0, None)

    def prever_serie(self, historico: pd.DataFrame, horizonte: int = 1) -> np.ndarray:
        """Previsão recursiva: cada semana prevista vira histórico da seguinte."""
        hist = historico[["semana", "sabor", "quantidade"]].copy()
        sabor = hist["sabor"].iloc[0]
        resultado = []
        for _ in range(horizonte):
            proxima = hist["semana"].max() + pd.Timedelta(weeks=1)
            linha = pd.DataFrame({"semana": [proxima], "sabor": [sabor], "quantidade": [np.nan]})
            df = adicionar_features(pd.concat([hist, linha], ignore_index=True))
            valor = float(self.prever_linhas(df.tail(1))[0])
            resultado.append(valor)
            hist = pd.concat([hist, linha.assign(quantidade=valor)], ignore_index=True)
        return np.array(resultado)


@dataclass
class Previsor:
    """Combina o modelo principal com o baseline como fallback."""
    principal: ModeloPrincipal | None
    baseline: BaselineMediaMovel = field(default_factory=BaselineMediaMovel)
    usar_principal: bool = True
    min_semanas: int = MIN_SEMANAS_MODELO
    metadados: dict = field(default_factory=dict)
    # Quantis dos resíduos padronizados por método, calibrados na validação (ver treino.py)
    intervalos: dict = field(default_factory=dict)
    nivel_intervalo: float = NIVEL_INTERVALO

    def metodo_para(self, historico: pd.DataFrame) -> str:
        sabor = historico["sabor"].iloc[0]
        if (self.usar_principal and self.principal is not None
                and sabor in self.principal.sabores and len(historico) >= self.min_semanas):
            return self.principal.nome
        return self.baseline.nome

    def prever(self, series: pd.DataFrame, horizonte: int = 1) -> pd.DataFrame:
        linhas = []
        for sabor, hist in series.groupby("sabor"):
            hist = hist.sort_values("semana")
            metodo = self.metodo_para(hist)
            if metodo == self.baseline.nome:
                valores = self.baseline.prever_serie(hist["quantidade"], horizonte)
            else:
                valores = self.principal.prever_serie(hist, horizonte)
            z = getattr(self, "intervalos", {}).get(metodo, Z_PADRAO)
            ultima = hist["semana"].max()
            for i, v in enumerate(valores, start=1):
                inferior, superior = intervalo(float(v), i, z)
                linhas.append({
                    "semana": ultima + pd.Timedelta(weeks=i),
                    "sabor": sabor,
                    "previsao": round(float(v), 2),
                    "limite_inferior": inferior,
                    "limite_superior": superior,
                    "metodo": metodo,
                })
        return pd.DataFrame(linhas)
