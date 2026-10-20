"""Coleta e preparação dos dados históricos de vendas.

Fontes aceitas:
- banco MySQL da aplicação (tabela ``vendas`` + ``receitas``), via ``DATABASE_URL``;
- CSV exportado pela tela de Vendas (botão "Exportar CSV").

As duas fontes são normalizadas para o mesmo formato de vendas
(``data``, ``sabor``, ``quantidade``) e depois agregadas em séries semanais por sabor.
"""
from __future__ import annotations

import os
from pathlib import Path

import pandas as pd

from .config import FREQ_SEMANAL, FUSO

COLUNAS_VENDAS = ["data", "sabor", "quantidade"]

CONSULTA_VENDAS = """
SELECT v.dataVenda AS data, r.nome AS sabor, v.quantidade AS quantidade
FROM vendas v
JOIN receitas r ON r.id = v.receitaId
"""


def _url_sqlalchemy(database_url: str) -> str:
    """Converte a DATABASE_URL do Prisma (mysql://) para o driver PyMySQL."""
    url = database_url.strip().strip('"')
    if url.startswith("mysql://"):
        url = "mysql+pymysql://" + url[len("mysql://"):]
    return url


def carregar_vendas_banco(database_url: str | None = None) -> pd.DataFrame:
    from sqlalchemy import create_engine

    database_url = database_url or os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("Defina DATABASE_URL ou use --csv com o export de vendas.")
    engine = create_engine(_url_sqlalchemy(database_url))
    with engine.connect() as conn:
        df = pd.read_sql(CONSULTA_VENDAS, conn)
    # O Prisma grava DateTime em UTC; as semanas são contadas no horário da pizzaria
    df["data"] = pd.to_datetime(df["data"]).dt.tz_localize("UTC")
    return normalizar_vendas(df)


def carregar_vendas_csv(caminho: str | Path) -> pd.DataFrame:
    """Lê o CSV exportado pela tela de Vendas (datas pt-BR, ex.: "19/10/2026, 21:10:05")."""
    df = pd.read_csv(caminho, dtype=str, encoding="utf-8-sig")
    if {"data", "sabor", "quantidade"}.issubset(df.columns):
        bruto = df[COLUNAS_VENDAS]
    else:
        bruto = pd.DataFrame({
            "data": df["Data"],
            "sabor": df["Receita"],
            "quantidade": df["Quantidade"],
        })
    datas = bruto["data"].str.replace(",", "", regex=False)
    bruto = bruto.assign(data=pd.to_datetime(datas, dayfirst=True, format="mixed"))
    return normalizar_vendas(bruto)


def normalizar_vendas(df: pd.DataFrame) -> pd.DataFrame:
    df = df[COLUNAS_VENDAS].copy()
    df["data"] = pd.to_datetime(df["data"], utc=False)
    if df["data"].dt.tz is not None:
        df["data"] = df["data"].dt.tz_convert(FUSO).dt.tz_localize(None)
    df["sabor"] = df["sabor"].astype(str).str.strip()
    df["quantidade"] = pd.to_numeric(df["quantidade"], errors="coerce")
    df = df.dropna(subset=["data", "quantidade"])
    df = df[(df["quantidade"] > 0) & (df["sabor"] != "")]
    return df.sort_values("data").reset_index(drop=True)


def series_semanais(vendas: pd.DataFrame, ate: pd.Timestamp | None = None) -> pd.DataFrame:
    """Agrega as vendas em unidades por sabor e semana.

    Semanas sem venda entram com zero, do início do histórico de cada sabor até a
    última semana completa (ou até ``ate``). Retorna colunas ``semana`` (segunda-feira),
    ``sabor`` e ``quantidade``.
    """
    if vendas.empty:
        return pd.DataFrame(columns=["semana", "sabor", "quantidade"])

    v = vendas.copy()
    v["semana"] = v["data"].dt.to_period(FREQ_SEMANAL)
    agregado = v.groupby(["sabor", "semana"], as_index=False)["quantidade"].sum()

    if ate is not None:
        ultima = pd.Timestamp(ate).to_period(FREQ_SEMANAL)
    else:
        # A semana corrente ainda está em andamento: considera só semanas fechadas
        ultima = v["data"].max().to_period(FREQ_SEMANAL)
        if v["data"].max().normalize() < ultima.end_time.normalize():
            ultima -= 1

    partes = []
    for sabor, grupo in agregado.groupby("sabor"):
        inicio = grupo["semana"].min()
        if inicio > ultima:
            continue
        semanas = pd.period_range(inicio, ultima, freq=FREQ_SEMANAL)
        serie = grupo.set_index("semana")["quantidade"].reindex(semanas, fill_value=0)
        partes.append(pd.DataFrame({
            "semana": semanas.start_time,
            "sabor": sabor,
            "quantidade": serie.to_numpy(dtype=float),
        }))
    if not partes:
        return pd.DataFrame(columns=["semana", "sabor", "quantidade"])
    return pd.concat(partes, ignore_index=True).sort_values(["sabor", "semana"]).reset_index(drop=True)
