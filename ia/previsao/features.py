"""Engenharia de features para o modelo global (todos os sabores juntos)."""
from __future__ import annotations

import numpy as np
import pandas as pd

from .config import JANELAS_MEDIA, LAGS


def adicionar_features(series: pd.DataFrame) -> pd.DataFrame:
    """Recebe ``semana``/``sabor``/``quantidade`` e devolve com as features de cada linha.

    Todas as features usam só semanas anteriores (``shift``), então a linha da semana
    *t* pode ser prevista com o que se sabe ao fim da semana *t-1*.
    """
    df = series.sort_values(["sabor", "semana"]).copy()
    grupo = df.groupby("sabor")["quantidade"]
    for lag in LAGS:
        df[f"lag_{lag}"] = grupo.shift(lag)
    anterior = grupo.shift(1)
    for janela in JANELAS_MEDIA:
        df[f"media_{janela}"] = anterior.groupby(df["sabor"]).transform(
            lambda s, j=janela: s.rolling(j, min_periods=1).mean())
    df["desvio_4"] = anterior.groupby(df["sabor"]).transform(
        lambda s: s.rolling(4, min_periods=2).std())

    semana_ano = df["semana"].dt.isocalendar().week.astype(float).to_numpy()
    df["semana_sin"] = np.sin(2 * np.pi * semana_ano / 52.18)
    df["semana_cos"] = np.cos(2 * np.pi * semana_ano / 52.18)
    df["mes"] = df["semana"].dt.month
    df["idade_semanas"] = df.groupby("sabor").cumcount()
    return df


def colunas_features(sabores: list[str]) -> list[str]:
    base = [f"lag_{l}" for l in LAGS] + [f"media_{j}" for j in JANELAS_MEDIA]
    base += ["desvio_4", "semana_sin", "semana_cos", "mes", "idade_semanas"]
    return base + [f"sabor_{s}" for s in sabores]


def matriz(df: pd.DataFrame, sabores: list[str]) -> pd.DataFrame:
    """Monta a matriz de features com one-hot do sabor (sabores desconhecidos ficam zerados)."""
    X = df.copy()
    for s in sabores:
        X[f"sabor_{s}"] = (X["sabor"] == s).astype(float)
    return X[colunas_features(sabores)].astype(float)
