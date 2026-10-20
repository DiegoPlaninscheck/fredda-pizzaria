"""Gerador de vendas sintéticas para desenvolver e testar o pipeline.

Enquanto a pizzaria não acumula histórico suficiente no sistema, estes dados imitam o
comportamento esperado: base diferente por sabor, mais vendas na sexta e no sábado,
sazonalidade anual (mais pizza no inverno), leve tendência de crescimento e feriados.
Nunca usar para avaliar o modelo final — só para validar o código.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

SABORES_PADRAO = {
    "Margherita": 14.0,
    "Calabresa": 18.0,
    "Quatro Queijos": 9.0,
    "Portuguesa": 7.0,
    "Pepperoni": 11.0,
}

# Peso relativo de cada dia da semana (segunda = 0)
PESO_DIA = np.array([0.6, 0.6, 0.8, 0.9, 1.5, 1.8, 1.0])


def gerar_vendas(inicio: str = "2024-01-01", semanas: int = 104, semente: int = 42,
                 sabores: dict[str, float] | None = None) -> pd.DataFrame:
    rng = np.random.default_rng(semente)
    sabores = sabores or SABORES_PADRAO
    dias = pd.date_range(inicio, periods=semanas * 7, freq="D")
    t = np.arange(len(dias))
    # Pico no inverno (julho) e vale no verão (janeiro)
    sazonal = 1 + 0.25 * np.sin(2 * np.pi * (dias.dayofyear.to_numpy() - 100) / 365.25)
    tendencia = 1 + 0.15 * t / len(dias)
    dia_semana = PESO_DIA[dias.dayofweek.to_numpy()] / PESO_DIA.mean()

    linhas = []
    for sabor, base_semanal in sabores.items():
        media = (base_semanal / 7) * sazonal * tendencia * dia_semana
        qtd = rng.poisson(media)
        for data, q in zip(dias, qtd):
            if q > 0:
                hora = data + pd.Timedelta(hours=int(rng.integers(11, 22)))
                linhas.append((hora, sabor, float(q)))
    return pd.DataFrame(linhas, columns=["data", "sabor", "quantidade"])
