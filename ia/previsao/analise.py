"""Análise exploratória das vendas e recomendação de abordagem.

Gera ``relatorios/analise_exploratoria.md`` com estatísticas por sabor e gráficos PNG.
A recomendação final (baseline, modelo global ou SARIMA/Prophet por sabor) é derivada
do tamanho e do comportamento do histórico.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]


def autocorrelacao(serie: pd.Series, lag: int) -> float:
    if len(serie) <= lag + 2 or serie.std() == 0:
        return float("nan")
    return float(serie.autocorr(lag))


def estatisticas(series: pd.DataFrame) -> pd.DataFrame:
    linhas = []
    for sabor, g in series.groupby("sabor"):
        q = g.sort_values("semana")["quantidade"].reset_index(drop=True)
        inclinacao = float(np.polyfit(np.arange(len(q)), q, 1)[0]) if len(q) >= 4 else float("nan")
        linhas.append({
            "sabor": sabor,
            "semanas": len(q),
            "total": q.sum(),
            "media": q.mean(),
            "desvio": q.std(),
            "cv": q.std() / q.mean() if q.mean() > 0 else float("nan"),
            "semanas_zeradas_%": 100 * (q == 0).mean(),
            "tendencia_un_semana": inclinacao,
            "acf_1": autocorrelacao(q, 1),
            "acf_4": autocorrelacao(q, 4),
            "acf_52": autocorrelacao(q, 52),
        })
    return pd.DataFrame(linhas).sort_values("total", ascending=False)


def recomendar(stats: pd.DataFrame) -> list[str]:
    semanas = int(stats["semanas"].median()) if not stats.empty else 0
    texto = []
    if semanas < 12:
        texto.append(f"Histórico mediano de {semanas} semanas: usar só o **baseline** "
                     "(média móvel de 4 semanas) até acumular pelo menos 12 semanas.")
        return texto
    texto.append(f"Histórico mediano de {semanas} semanas por sabor e {len(stats)} sabores.")
    if semanas < 104:
        texto.append("Menos de 2 anos de dados: SARIMA sazonal (m=52) e Prophet com "
                     "sazonalidade anual não têm ciclos suficientes para estimar a sazonalidade "
                     "de forma confiável em cada sabor isolado.")
    else:
        texto.append("Há 2 anos ou mais de dados: SARIMA/Prophet por sabor passam a ser "
                     "viáveis e devem entrar na comparação da Sprint 6.")
    texto.append("Abordagem escolhida: **modelo global de gradient boosting** "
                 "(scikit-learn `HistGradientBoostingRegressor`, perda Poisson) treinado com "
                 "todos os sabores juntos. Ele compartilha padrões entre sabores (sazonalidade, "
                 "tendência), aceita sabores novos com pouco histórico e roda no mesmo stack do "
                 "microsserviço FastAPI + scikit-learn previsto no roadmap. XGBoost fica como "
                 "alternativa equivalente, sem dependência extra.")
    texto.append("O **baseline** continua como fallback para sabores com pouco histórico e "
                 "para o caso de o modelo principal não superar o baseline na validação.")
    cv = stats["cv"].median()
    if pd.notna(cv) and cv > 1:
        texto.append(f"Atenção: variação alta (CV mediano {cv:.2f}); considerar agregar sabores "
                     "pouco vendidos ou prever em nível de massa (total) antes de detalhar.")
    return texto


def _graficos(vendas: pd.DataFrame, series: pd.DataFrame, destino: Path) -> list[str]:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    arquivos = []

    fig, ax = plt.subplots(figsize=(10, 4))
    for sabor, g in series.groupby("sabor"):
        ax.plot(g["semana"], g["quantidade"], label=sabor, linewidth=1.2)
    ax.set_title("Vendas semanais por sabor")
    ax.set_ylabel("unidades")
    ax.legend(fontsize=8, ncol=2)
    fig.tight_layout()
    fig.savefig(destino / "series_por_sabor.png", dpi=110)
    plt.close(fig)
    arquivos.append("series_por_sabor.png")

    total = series.groupby("semana")["quantidade"].sum()
    fig, ax = plt.subplots(figsize=(10, 3.5))
    ax.plot(total.index, total.to_numpy(), color="#2b6b4d", label="total")
    ax.plot(total.index, total.rolling(4, min_periods=1).mean().to_numpy(),
            color="#e07a1f", label="média móvel 4 sem.")
    ax.set_title("Vendas semanais totais")
    ax.legend()
    fig.tight_layout()
    fig.savefig(destino / "total_semanal.png", dpi=110)
    plt.close(fig)
    arquivos.append("total_semanal.png")

    perfil = vendas.groupby(vendas["data"].dt.dayofweek)["quantidade"].sum().reindex(range(7), fill_value=0)
    fig, ax = plt.subplots(figsize=(6, 3.5))
    ax.bar(DIAS, perfil.to_numpy(), color="#3d8563")
    ax.set_title("Vendas por dia da semana")
    fig.tight_layout()
    fig.savefig(destino / "dia_da_semana.png", dpi=110)
    plt.close(fig)
    arquivos.append("dia_da_semana.png")
    return arquivos


def _tabela_md(df: pd.DataFrame) -> str:
    cab = "| " + " | ".join(df.columns) + " |"
    sep = "|" + "|".join("---" for _ in df.columns) + "|"
    linhas = []
    for _, r in df.iterrows():
        valores = [f"{v:.2f}" if isinstance(v, (float, np.floating)) else str(v) for v in r]
        linhas.append("| " + " | ".join(valores) + " |")
    return "\n".join([cab, sep, *linhas])


def gerar_relatorio(vendas: pd.DataFrame, series: pd.DataFrame, destino: Path,
                    graficos: bool = True) -> Path:
    destino.mkdir(parents=True, exist_ok=True)
    stats = estatisticas(series)
    imagens = _graficos(vendas, series, destino) if graficos else []

    partes = [
        "# Análise exploratória das vendas",
        "",
        f"- Período: {vendas['data'].min():%d/%m/%Y} a {vendas['data'].max():%d/%m/%Y}",
        f"- Registros de venda: {len(vendas)}",
        f"- Unidades vendidas: {vendas['quantidade'].sum():.0f}",
        f"- Sabores: {series['sabor'].nunique()}",
        f"- Semanas completas no histórico: {series['semana'].nunique()}",
        "",
        "## Estatísticas semanais por sabor",
        "",
        _tabela_md(stats),
        "",
        "`cv` = desvio/média; `acf_k` = autocorrelação com k semanas de defasagem "
        "(acf_52 alto indica sazonalidade anual).",
        "",
        "## Abordagem recomendada",
        "",
        *[f"- {t}" for t in recomendar(stats)],
        "",
    ]
    if imagens:
        partes += ["## Gráficos", ""] + [f"![{i}]({i})" for i in imagens] + [""]
    arquivo = destino / "analise_exploratoria.md"
    arquivo.write_text("\n".join(partes), encoding="utf-8")
    return arquivo
