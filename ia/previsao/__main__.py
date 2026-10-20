"""Linha de comando do módulo de previsão.

    python -m previsao preparar --banco | --csv vendas.csv | --sintetico
    python -m previsao analisar
    python -m previsao treinar
    python -m previsao prever [--semanas 2]
"""
from __future__ import annotations

import argparse
import json
import joblib
import pandas as pd

from . import dados
from .analise import gerar_relatorio
from .config import DIR_DADOS, DIR_MODELOS, DIR_RELATORIOS
from .modelos import Previsor
from .treino import treinar_previsor

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
    previsor, relatorio = treinar_previsor(series, iteracoes=args.iteracoes,
                                           ajustar_params=not args.sem_ajuste)
    DIR_MODELOS.mkdir(parents=True, exist_ok=True)
    joblib.dump(previsor, ARQ_MODELO)
    ARQ_METADADOS.write_text(json.dumps(previsor.metadados, indent=2, ensure_ascii=False),
                             encoding="utf-8")

    validacao = previsor.metadados["validacao"]
    if validacao:
        DIR_RELATORIOS.mkdir(parents=True, exist_ok=True)
        (DIR_RELATORIOS / "avaliacao.md").write_text(relatorio, encoding="utf-8")
        print(f"Validação (últimas {validacao['semanas_validacao']} semanas, 1 semana à frente):")
        for nome in ("baseline", "principal"):
            m = validacao[nome]
            print(f"  {nome:<9} MAE {m['mae']:.2f}  RMSE {m['rmse']:.2f}  "
                  f"MAPE {m['mape']:.1%}  WAPE {m['wape']:.1%}")
        print(f"Hiperparâmetros: {validacao['params']}")
        print(f"Relatório: {DIR_RELATORIOS / 'avaliacao.md'}")
    else:
        print("Histórico curto demais para validar: usando só o baseline.")
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

    p = sub.add_parser("treinar", help="ajusta, valida e treina baseline + modelo principal")
    p.add_argument("--iteracoes", type=int, default=20, help="combinações testadas no ajuste")
    p.add_argument("--sem-ajuste", action="store_true", help="usa os hiperparâmetros padrão")
    p.set_defaults(func=cmd_treinar)

    p = sub.add_parser("prever", help="prevê as próximas semanas por sabor")
    p.add_argument("--semanas", type=int, default=1)
    p.set_defaults(func=cmd_prever)

    args = parser.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
