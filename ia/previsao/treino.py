"""Pipeline de treinamento usado pela CLI e pelo microsserviço."""
from __future__ import annotations

from datetime import datetime, timezone

import pandas as pd

from .avaliacao import ajustar, relatorio_markdown, validar
from .modelos import BaselineMediaMovel, ModeloPrincipal, Previsor


def treinar_previsor(series: pd.DataFrame, iteracoes: int = 20,
                     ajustar_params: bool = True) -> tuple[Previsor, str | None]:
    """Ajusta, valida e treina; devolve o Previsor e o relatório de avaliação em Markdown.

    Com histórico curto demais para validar, devolve um Previsor só com o baseline.
    """
    ajuste = None
    if ajustar_params:
        try:
            ajuste = ajustar(series, iteracoes=iteracoes)
        except ValueError:
            ajuste = None
    params = ajuste["melhores_params"] if ajuste else None

    try:
        validacao = validar(series, params=params)
    except ValueError:
        validacao = None

    principal = None
    usar_principal = False
    if validacao is not None:
        principal = ModeloPrincipal(params=validacao["params"]).treinar(series)
        usar_principal = validacao["principal_supera_baseline"]

    previsor = Previsor(principal=principal, baseline=BaselineMediaMovel(),
                        usar_principal=usar_principal,
                        intervalos=validacao["intervalos"] if validacao else {})
    previsor.metadados = {
        "treinado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "semanas": int(series["semana"].nunique()) if not series.empty else 0,
        "ultima_semana": str(series["semana"].max().date()) if not series.empty else None,
        "sabores": sorted(series["sabor"].unique()) if not series.empty else [],
        "modelo_ativo": principal.nome if usar_principal else previsor.baseline.nome,
        "params": validacao["params"] if validacao else None,
        "ajuste_iteracoes": ajuste["iteracoes"] if ajuste else 0,
        "validacao": validacao,
    }
    relatorio = relatorio_markdown(validacao, ajuste) if validacao else None
    return previsor, relatorio
