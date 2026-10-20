"""Avaliação do modelo: métricas, validação temporal e ajuste de hiperparâmetros.

Todas as avaliações respeitam a ordem do tempo: o modelo é treinado só com semanas
anteriores às que prevê, e cada semana avaliada é prevista com uma semana de antecedência
(o horizonte do planejamento semanal de produção).

Fluxo usado pelo comando ``treinar``:
1. As últimas ``SEMANAS_VALIDACAO`` semanas ficam reservadas como holdout final.
2. ``ajustar`` busca hiperparâmetros com validação cruzada temporal (janela expansível)
   apenas nas semanas anteriores ao holdout.
3. ``validar`` treina com os melhores parâmetros e compara baseline e modelo principal
   no holdout, que nunca participou da escolha dos parâmetros.
"""
from __future__ import annotations

import itertools
import random

import numpy as np
import pandas as pd

from .config import (DOBRAS_AJUSTE, MIN_DOBRAS_AJUSTE, MIN_SEMANAS_TREINO_DOBRA, SEMANAS_DOBRA,
                     SEMANAS_VALIDACAO)
from .features import adicionar_features
from .config import NIVEL_INTERVALO
from .modelos import JANELA_BASELINE, PARAMS_PADRAO, BaselineMediaMovel, ModeloPrincipal, escala_residuo

# Espaço de busca dos hiperparâmetros do HistGradientBoostingRegressor
GRADE_PARAMS = {
    "learning_rate": [0.03, 0.05, 0.1],
    "max_iter": [150, 300, 500],
    "max_leaf_nodes": [7, 15, 31],
    "min_samples_leaf": [5, 10, 20],
    "l2_regularization": [0.0, 1.0, 5.0],
}


def metricas(real, previsto) -> dict:
    real = np.asarray(real, dtype=float)
    previsto = np.asarray(previsto, dtype=float)
    erro = previsto - real
    total = np.abs(real).sum()
    com_venda = real > 0
    return {
        "mae": float(np.mean(np.abs(erro))),
        "rmse": float(np.sqrt(np.mean(erro ** 2))),
        # MAPE só nas semanas com venda (indefinido quando o real é zero)
        "mape": float(np.mean(np.abs(erro[com_venda]) / real[com_venda])) if com_venda.any() else float("nan"),
        # WAPE: erro absoluto total / volume real (não explode com semanas zeradas)
        "wape": float(np.abs(erro).sum() / total) if total > 0 else float("nan"),
    }


def _semanas(series: pd.DataFrame) -> np.ndarray:
    return np.sort(series["semana"].unique())


def _prever_periodo(series: pd.DataFrame, inicio, fim, params: dict) -> pd.DataFrame:
    """Treina com semanas < inicio e prevê (1 semana à frente) as semanas em [inicio, fim)."""
    treino = series[series["semana"] < inicio]
    modelo = ModeloPrincipal(params=params).treinar(treino)
    df = adicionar_features(series[series["semana"] < fim])
    df["baseline"] = df.groupby("sabor")["quantidade"].transform(
        lambda s: s.shift(1).rolling(JANELA_BASELINE, min_periods=1).mean())
    teste = df[(df["semana"] >= inicio) & df["lag_1"].notna()].copy()
    teste["principal"] = modelo.prever_linhas(teste)
    return teste


def backtest(series: pd.DataFrame, params: dict, dobras: int = DOBRAS_AJUSTE,
             semanas_dobra: int = SEMANAS_DOBRA) -> dict:
    """Validação cruzada temporal com janela expansível; devolve as métricas agregadas."""
    semanas = _semanas(series)
    necessario = dobras * semanas_dobra + 8
    if len(semanas) < necessario:
        raise ValueError(f"Backtest precisa de {necessario} semanas (há {len(semanas)}).")
    partes = []
    for i in range(dobras, 0, -1):
        inicio = semanas[-i * semanas_dobra]
        fim = semanas[-(i - 1) * semanas_dobra] if i > 1 else semanas[-1] + np.timedelta64(1, "D")
        partes.append(_prever_periodo(series, inicio, fim, params))
    teste = pd.concat(partes)
    return {
        "baseline": metricas(teste["quantidade"], teste["baseline"]),
        "principal": metricas(teste["quantidade"], teste["principal"]),
        "linhas": int(len(teste)),
    }


def candidatos(iteracoes: int, semente: int = 42) -> list[dict]:
    """Os parâmetros padrão + uma amostra aleatória da grade (busca aleatória)."""
    chaves = list(GRADE_PARAMS)
    grade = [dict(zip(chaves, v)) for v in itertools.product(*GRADE_PARAMS.values())]
    random.Random(semente).shuffle(grade)
    lista = [dict(PARAMS_PADRAO)]
    for p in grade:
        if len(lista) >= iteracoes:
            break
        if p != PARAMS_PADRAO:
            lista.append(p)
    return lista


def ajustar(series: pd.DataFrame, iteracoes: int = 20,
            semanas_validacao: int = SEMANAS_VALIDACAO) -> dict:
    """Busca aleatória de hiperparâmetros nas semanas anteriores ao holdout final."""
    semanas = _semanas(series)
    disponiveis = (len(semanas) - semanas_validacao - MIN_SEMANAS_TREINO_DOBRA) // SEMANAS_DOBRA
    dobras = min(DOBRAS_AJUSTE, disponiveis)
    if dobras < MIN_DOBRAS_AJUSTE:
        raise ValueError("Histórico curto demais para ajustar hiperparâmetros.")
    corte = semanas[-semanas_validacao]
    desenvolvimento = series[series["semana"] < corte]

    resultados = []
    for params in candidatos(iteracoes):
        r = backtest(desenvolvimento, params, dobras=dobras)
        resultados.append({"params": params, **r["principal"]})
    resultados.sort(key=lambda r: r["mae"])
    return {
        "melhores_params": resultados[0]["params"],
        "iteracoes": len(resultados),
        "dobras": dobras,
        "ranking": resultados,
    }


def validar(series: pd.DataFrame, params: dict | None = None,
            semanas_validacao: int = SEMANAS_VALIDACAO) -> dict:
    """Holdout final: treina com tudo antes do corte e prevê cada semana de validação."""
    semanas = _semanas(series)
    if len(semanas) <= semanas_validacao + 4:
        raise ValueError(
            f"São necessárias mais de {semanas_validacao + 4} semanas de histórico para validar "
            f"(há {len(semanas)}).")
    corte = semanas[-semanas_validacao]
    params = params or dict(PARAMS_PADRAO)
    teste = _prever_periodo(series, corte, semanas[-1] + np.timedelta64(1, "D"), params)

    resultado = {
        "corte": str(pd.Timestamp(corte).date()),
        "semanas_validacao": int(semanas_validacao),
        "linhas_teste": int(len(teste)),
        "params": params,
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
    resultado["intervalos"] = {
        BaselineMediaMovel.nome: quantis_residuos(teste["quantidade"], teste["baseline"]),
        ModeloPrincipal.nome: quantis_residuos(teste["quantidade"], teste["principal"]),
    }
    return resultado


def quantis_residuos(real, previsto, nivel: float = NIVEL_INTERVALO) -> dict:
    """Quantis dos resíduos padronizados ((real - previsto) / raiz(previsto)).

    Calibrados no holdout, definem a largura do intervalo de previsão. A cobertura
    informada é a do próprio holdout (otimista, já que os quantis vêm dessas semanas).
    """
    real = np.asarray(real, dtype=float)
    previsto = np.asarray(previsto, dtype=float)
    z = (real - previsto) / escala_residuo(previsto)
    alfa = (1 - nivel) / 2
    z_inf, z_sup = float(np.quantile(z, alfa)), float(np.quantile(z, 1 - alfa))
    return {"z_inf": round(z_inf, 4), "z_sup": round(z_sup, 4), "nivel": nivel}


def relatorio_markdown(validacao: dict, ajuste: dict | None) -> str:
    def linha(nome, m):
        return f"| {nome} | {m['mae']:.2f} | {m['rmse']:.2f} | {m['mape']:.1%} | {m['wape']:.1%} |"

    cab = ["| Modelo | MAE | RMSE | MAPE | WAPE |", "|---|---|---|---|---|"]
    partes = [
        "# Avaliação do modelo de previsão",
        "",
        f"Holdout: {validacao['semanas_validacao']} semanas a partir de {validacao['corte']}, "
        f"cada uma prevista com 1 semana de antecedência ({validacao['linhas_teste']} previsões).",
        "",
        "## Resultado geral",
        "",
        *cab,
        linha("Baseline (média móvel 4 sem.)", validacao["baseline"]),
        linha("Modelo principal", validacao["principal"]),
        "",
        "Modelo ativo: **" + ("principal" if validacao["principal_supera_baseline"] else "baseline")
        + "** (o principal só é ativado com MAE menor que o baseline).",
        "",
        "## Por sabor",
        "",
        "| Sabor | MAE baseline | MAE principal | MAPE baseline | MAPE principal |",
        "|---|---|---|---|---|",
    ]
    for sabor, m in validacao["por_sabor"].items():
        b, p = m["baseline"], m["principal"]
        partes.append(f"| {sabor} | {b['mae']:.2f} | {p['mae']:.2f} | {b['mape']:.1%} | {p['mape']:.1%} |")
    partes += ["", "## Hiperparâmetros", ""]
    partes += [f"- `{k}` = {v}" for k, v in validacao["params"].items()]
    if ajuste:
        partes += [
            "",
            f"Escolhidos por busca aleatória ({ajuste['iteracoes']} combinações) com validação "
            f"cruzada temporal de {ajuste['dobras']} dobras de {SEMANAS_DOBRA} semanas, só com as "
            "semanas anteriores ao holdout.",
            "",
            "| # | MAE (validação cruzada) | learning_rate | max_iter | max_leaf_nodes | min_samples_leaf | l2 |",
            "|---|---|---|---|---|---|---|",
        ]
        for i, r in enumerate(ajuste["ranking"][:5], start=1):
            p = r["params"]
            partes.append(f"| {i} | {r['mae']:.2f} | {p['learning_rate']} | {p['max_iter']} | "
                          f"{p['max_leaf_nodes']} | {p['min_samples_leaf']} | {p['l2_regularization']} |")
    partes += ["", "## Intervalo de previsão", "",
               f"Intervalo de {NIVEL_INTERVALO:.0%}: previsão + z × raiz(previsão) × raiz(semanas à frente), "
               "com z = quantis dos resíduos padronizados no holdout.", "",
               "| Método | z inferior | z superior |", "|---|---|---|"]
    for metodo, z in validacao.get("intervalos", {}).items():
        partes.append(f"| {metodo} | {z['z_inf']:.2f} | {z['z_sup']:.2f} |")
    partes += ["", "MAPE considera só as semanas com venda; WAPE = erro absoluto total / volume vendido.", ""]
    return "\n".join(partes)
