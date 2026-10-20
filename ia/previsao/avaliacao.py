"""Validação holdout (últimas semanas) comparando baseline e modelo principal.

A avaliação completa com ajuste de hiperparâmetros e MAPE fica para a Sprint 6; aqui
o objetivo é decidir se o modelo principal já supera o baseline.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .config import SEMANAS_VALIDACAO
from .features import adicionar_features
from .modelos import JANELA_BASELINE, ModeloPrincipal


def metricas(real: np.ndarray, previsto: np.ndarray) -> dict:
    real = np.asarray(real, dtype=float)
    previsto = np.asarray(previsto, dtype=float)
    erro = previsto - real
    total = np.abs(real).sum()
    return {
        "mae": float(np.mean(np.abs(erro))),
        "rmse": float(np.sqrt(np.mean(erro ** 2))),
        # WAPE: erro absoluto total / volume real (não explode com semanas zeradas)
        "wape": float(np.abs(erro).sum() / total) if total > 0 else float("nan"),
    }


def validar(series: pd.DataFrame, semanas_validacao: int = SEMANAS_VALIDACAO) -> dict:
    """Treina com tudo antes do corte e prevê 1 semana à frente em cada semana de validação."""
    semanas = np.sort(series["semana"].unique())
    if len(semanas) <= semanas_validacao + 4:
        raise ValueError(
            f"São necessárias mais de {semanas_validacao + 4} semanas de histórico para validar "
            f"(há {len(semanas)}).")
    corte = semanas[-semanas_validacao]
    treino = series[series["semana"] < corte]

    modelo = ModeloPrincipal().treinar(treino)

    df = adicionar_features(series)
    df["baseline"] = df.groupby("sabor")["quantidade"].transform(
        lambda s: s.shift(1).rolling(JANELA_BASELINE, min_periods=1).mean())
    teste = df[(df["semana"] >= corte) & df["lag_1"].notna()].copy()
    teste["principal"] = modelo.prever_linhas(teste)

    resultado = {
        "corte": str(pd.Timestamp(corte).date()),
        "semanas_validacao": int(semanas_validacao),
        "linhas_teste": int(len(teste)),
        "baseline": metricas(teste["quantidade"], teste["baseline"]),
        "principal": metricas(teste["quantidade"], teste["principal"]),
        "por_sabor": {},
    }
    for sabor, g in teste.groupby("sabor"):
        resultado["por_sabor"][sabor] = {
            "baseline": metricas(g["quantidade"], g["baseline"]),
            "principal": metricas(g["quantidade"], g["principal"]),
        }
    resultado["principal_supera_baseline"] = (
        resultado["principal"]["mae"] < resultado["baseline"]["mae"])
    return resultado
