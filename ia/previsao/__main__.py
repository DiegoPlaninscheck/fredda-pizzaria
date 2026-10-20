"""Linha de comando do módulo de previsão.

    python -m previsao preparar --banco | --csv vendas.csv | --sintetico
    python -m previsao analisar
    python -m previsao treinar
    python -m previsao prever [--semanas 2]
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone

import joblib
import pandas as pd

from . import dados
from .analise import gerar_relatorio
from .avaliacao import validar
from .config import DIR_DADOS, DIR_MODELOS, DIR_RELATORIOS
from .modelos import BaselineMediaMovel, ModeloPrincipal, Previsor

ARQ_VENDAS = DIR_DADOS / "vendas.csv"
ARQ_SERIES = DIR_DADOS / "series_semanais.csv"
ARQ_MODELO = DIR_MODELOS / "previsor.joblib"
ARQ_METADADOS = DIR_MODELOS / "metadados.json"


def _ler_preparados() -> tuple[pd.DataFrame, pd.DataFrame]:
    if not ARQ_SERIES.exists():
        raise SystemExit("Rode primeiro: python -m previsao preparar ...")
    vendas = pd.read_csv(ARQ_VENDAS, parse_dates=["data"])
    series = pd.read_csv(ARQ_SERIES, parse_dates=["semana"])
    return vendas, series


def cmd_preparar(args):
    if args.csv:
        vendas = dados.carregar_vendas_csv(args.csv)
        origem = f"csv:{args.csv}"
    elif args.sintetico:
        from .sinteticos import gerar_vendas
        vendas = dados.normalizar_vendas(gerar_vendas(semanas=args.semanas))
        origem = "sintetico"
    else:
        vendas = dados.carregar_vendas_banco()
        origem = "banco"
    series = dados.series_semanais(vendas)
    DIR_DADOS.mkdir(parents=True, exist_ok=True)
    vendas.to_csv(ARQ_VENDAS, index=False)
    series.to_csv(ARQ_SERIES, index=False)
    print(f"Origem: {origem}")
    print(f"{len(vendas)} vendas → {len(series)} linhas semanais "
          f"({series['sabor'].nunique()} sabores, {series['semana'].nunique()} semanas)")
    print(f"Salvo em {ARQ_SERIES}")


def cmd_analisar(args):
    vendas, series = _ler_preparados()
    arquivo = gerar_relatorio(vendas, series, DIR_RELATORIOS, graficos=not args.sem_graficos)
    print(f"Relatório: {arquivo}")


def cmd_treinar(args):
    _, series = _ler_preparados()
    try:
        validacao = validar(series)
    except ValueError as e:
        print(f"Validação não executada: {e}")
        validacao = None

    principal = None
    usar_principal = False
    if validacao is not None:
        principal = ModeloPrincipal().treinar(series)
        usar_principal = validacao["principal_supera_baseline"]

    previsor = Previsor(principal=principal, baseline=BaselineMediaMovel(),
                        usar_principal=usar_principal)
    previsor.metadados = {
        "treinado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "semanas": int(series["semana"].nunique()),
        "ultima_semana": str(series["semana"].max().date()),
        "sabores": sorted(series["sabor"].unique()),
        "modelo_ativo": principal.nome if usar_principal else previsor.baseline.nome,
        "validacao": validacao,
    }
    DIR_MODELOS.mkdir(parents=True, exist_ok=True)
    joblib.dump(previsor, ARQ_MODELO)
    ARQ_METADADOS.write_text(json.dumps(previsor.metadados, indent=2, ensure_ascii=False),
                             encoding="utf-8")

    if validacao:
        b, p = validacao["baseline"], validacao["principal"]
        print(f"Validação (últimas {validacao['semanas_validacao']} semanas, 1 semana à frente):")
        print(f"  baseline  MAE {b['mae']:.2f}  RMSE {b['rmse']:.2f}  WAPE {b['wape']:.1%}")
        print(f"  principal MAE {p['mae']:.2f}  RMSE {p['rmse']:.2f}  WAPE {p['wape']:.1%}")
    print(f"Modelo ativo: {previsor.metadados['modelo_ativo']}")
    print(f"Salvo em {ARQ_MODELO}")


def cmd_prever(args):
    if not ARQ_MODELO.exists():
        raise SystemExit("Rode primeiro: python -m previsao treinar")
    _, series = _ler_preparados()
    previsor: Previsor = joblib.load(ARQ_MODELO)
    previsao = previsor.prever(series, horizonte=args.semanas)
    previsao["semana"] = previsao["semana"].dt.strftime("%d/%m/%Y")
    print(previsao.to_string(index=False))


def main(argv=None):
    parser = argparse.ArgumentParser(prog="previsao", description="Previsão de demanda — Fredda Pizzaria")
    sub = parser.add_subparsers(dest="comando", required=True)

    p = sub.add_parser("preparar", help="coleta as vendas e gera as séries semanais")
    fonte = p.add_mutually_exclusive_group()
    fonte.add_argument("--banco", action="store_true", help="lê do MySQL via DATABASE_URL (padrão)")
    fonte.add_argument("--csv", help="CSV exportado pela tela de Vendas")
    fonte.add_argument("--sintetico", action="store_true", help="gera dados sintéticos para teste")
    p.add_argument("--semanas", type=int, default=104, help="semanas de dados sintéticos")
    p.set_defaults(func=cmd_preparar)

    p = sub.add_parser("analisar", help="gera o relatório de análise exploratória")
    p.add_argument("--sem-graficos", action="store_true")
    p.set_defaults(func=cmd_analisar)

    p = sub.add_parser("treinar", help="valida e treina baseline + modelo principal")
    p.set_defaults(func=cmd_treinar)

    p = sub.add_parser("prever", help="prevê as próximas semanas por sabor")
    p.add_argument("--semanas", type=int, default=1)
    p.set_defaults(func=cmd_prever)

    args = parser.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
