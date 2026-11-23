"""Microsserviço REST de previsão de demanda (Sprint 6).

Rotas:
- ``GET  /saude``     — sem autenticação; diz se o serviço está no ar e qual modelo está ativo.
- ``GET  /modelo``    — metadados e métricas de validação do modelo carregado.
- ``POST /previsao``  — previsão das próximas semanas por sabor.
- ``POST /treinar``   — retreina com o histórico do banco e passa a usar o novo modelo.

As rotas protegidas exigem o cabeçalho ``X-API-Key`` igual a ``IA_API_KEY``. Sem
``IA_API_KEY`` configurada o serviço recusa todas elas (falha fechada).

As vendas vêm do MySQL da aplicação (``DATABASE_URL``) ou, opcionalmente, no corpo de
``/previsao`` (útil para testes e para chamar o serviço sem acesso ao banco).
"""
from __future__ import annotations

import json
import logging
import os
import secrets
import threading
from contextlib import asynccontextmanager
from datetime import date, datetime
from pathlib import Path

import joblib
import pandas as pd
from fastapi import Depends, FastAPI, HTTPException, Security
from fastapi.security import APIKeyHeader
from prometheus_client import Counter, Histogram, Info
from prometheus_fastapi_instrumentator import Instrumentator
from pydantic import BaseModel, Field

from previsao import dados
from previsao.config import DIR_MODELOS
from previsao.modelos import Previsor
from previsao.treino import treinar_previsor

log = logging.getLogger("fredda.ia")

ARQ_MODELO = Path(os.environ.get("IA_MODELO_PATH", DIR_MODELOS / "previsor.joblib"))
ARQ_METADADOS = ARQ_MODELO.with_name("metadados.json")
MAX_SEMANAS = 8


class Estado:
    previsor: Previsor | None = None
    trava = threading.Lock()


estado = Estado()

# ─── Métricas (Prometheus, rota /metrics só na rede interna do compose) ─────────

PREVISOES = Counter("fredda_ia_previsoes_total", "Previsões atendidas, por modelo ativo", ["modelo"])
TREINOS = Counter("fredda_ia_treinos_total", "Treinamentos solicitados, por resultado", ["resultado"])
DURACAO_TREINO = Histogram("fredda_ia_treino_duracao_seconds", "Duração dos treinamentos",
                           buckets=(5, 15, 30, 60, 120, 300, 600))
MODELO_INFO = Info("fredda_ia_modelo", "Modelo de previsão carregado no serviço")


def _atualizar_info_modelo() -> None:
    meta = estado.previsor.metadados if estado.previsor else {}
    MODELO_INFO.info({"modelo_ativo": str(meta.get("modelo_ativo") or ""),
                      "treinado_em": str(meta.get("treinado_em") or "")})


def carregar_modelo() -> None:
    if ARQ_MODELO.exists():
        estado.previsor = joblib.load(ARQ_MODELO)
        log.info("Modelo carregado: %s", estado.previsor.metadados.get("modelo_ativo"))
    else:
        # Sem modelo treinado ainda: atende só com o baseline até o primeiro /treinar
        estado.previsor = Previsor(principal=None, usar_principal=False,
                                   metadados={"modelo_ativo": "baseline_media_movel_4",
                                              "treinado_em": None})
        log.warning("Nenhum modelo em %s; usando só o baseline.", ARQ_MODELO)
    _atualizar_info_modelo()


@asynccontextmanager
async def ciclo_de_vida(_app: FastAPI):
    carregar_modelo()
    yield


app = FastAPI(title="Fredda Pizzaria — Previsão de demanda", version="1.0.0",
              lifespan=ciclo_de_vida)

# Latência e contagem de requisições HTTP por rota; /saude (healthcheck) fica de fora
Instrumentator(excluded_handlers=["/metrics", "/saude"]).instrument(app).expose(
    app, include_in_schema=False)

cabecalho_chave = APIKeyHeader(name="X-API-Key", auto_error=False)


def exigir_chave(chave: str | None = Security(cabecalho_chave)) -> None:
    esperada = os.environ.get("IA_API_KEY", "")
    if not esperada:
        raise HTTPException(503, "IA_API_KEY não configurada no serviço.")
    if not chave or not secrets.compare_digest(chave.encode(), esperada.encode()):
        raise HTTPException(401, "API key inválida.")


# ─── Esquemas ────────────────────────────────────────────────────────────────

class VendaEntrada(BaseModel):
    data: datetime
    sabor: str = Field(min_length=1)
    quantidade: float = Field(gt=0)


class PedidoPrevisao(BaseModel):
    semanas: int = Field(1, ge=1, le=MAX_SEMANAS)
    ate: date | None = Field(
        None, description="Último dia do histórico considerado; a semana que o contém entra "
                          "inteira e semanas sem venda até ela contam como zero. Padrão: última "
                          "semana completa com venda.")
    sabores: list[str] | None = Field(None, description="Filtra os sabores; todos se vazio.")
    vendas: list[VendaEntrada] | None = Field(
        None, description="Histórico de vendas; se ausente, lê do banco (DATABASE_URL).")


class ItemPrevisao(BaseModel):
    semana: str
    sabor: str
    previsao: float
    limite_inferior: float
    limite_superior: float
    metodo: str


class RespostaPrevisao(BaseModel):
    modelo_ativo: str
    nivel_confianca: float
    treinado_em: str | None
    ultima_semana_historico: str | None
    previsoes: list[ItemPrevisao]


class PedidoTreino(BaseModel):
    iteracoes: int = Field(20, ge=1, le=100)


# ─── Rotas ───────────────────────────────────────────────────────────────────

def _series(vendas: list[VendaEntrada] | None, ate: date | None = None) -> pd.DataFrame:
    if vendas is not None:
        df = dados.normalizar_vendas(pd.DataFrame([v.model_dump() for v in vendas]))
    else:
        try:
            df = dados.carregar_vendas_banco()
        except Exception as e:  # banco fora do ar ou DATABASE_URL ausente
            log.exception("Falha ao ler vendas do banco")
            raise HTTPException(503, f"Não foi possível ler as vendas do banco: {e.__class__.__name__}")
    if ate is not None:
        df = df[df["data"] < pd.Timestamp(ate) + pd.Timedelta(days=1)]
    return dados.series_semanais(df, ate=pd.Timestamp(ate) if ate else None)


@app.get("/saude")
def saude():
    meta = estado.previsor.metadados if estado.previsor else {}
    return {"status": "ok", "modelo_ativo": meta.get("modelo_ativo"),
            "treinado_em": meta.get("treinado_em")}


@app.get("/modelo", dependencies=[Depends(exigir_chave)])
def modelo():
    return estado.previsor.metadados


@app.post("/previsao", response_model=RespostaPrevisao, dependencies=[Depends(exigir_chave)])
def previsao(pedido: PedidoPrevisao):
    series = _series(pedido.vendas, pedido.ate)
    if pedido.sabores:
        series = series[series["sabor"].isin(pedido.sabores)]
    previsor = estado.previsor
    resultado = previsor.prever(series, horizonte=pedido.semanas) if not series.empty else pd.DataFrame()
    itens = [] if resultado.empty else [
        ItemPrevisao(semana=r.semana.date().isoformat(), sabor=r.sabor, previsao=r.previsao,
                     limite_inferior=r.limite_inferior, limite_superior=r.limite_superior,
                     metodo=r.metodo)
        for r in resultado.itertuples()
    ]
    PREVISOES.labels(modelo=previsor.metadados.get("modelo_ativo", "")).inc()
    return RespostaPrevisao(
        modelo_ativo=previsor.metadados.get("modelo_ativo", ""),
        nivel_confianca=getattr(previsor, "nivel_intervalo", 0.8),
        treinado_em=previsor.metadados.get("treinado_em"),
        ultima_semana_historico=None if series.empty else series["semana"].max().date().isoformat(),
        previsoes=itens,
    )


@app.post("/treinar", dependencies=[Depends(exigir_chave)])
def treinar(pedido: PedidoTreino | None = None):
    pedido = pedido or PedidoTreino()
    if not estado.trava.acquire(blocking=False):
        TREINOS.labels(resultado="ocupado").inc()
        raise HTTPException(409, "Já existe um treinamento em andamento.")
    try:
        with DURACAO_TREINO.time():
            series = _series(None)
            if series.empty:
                raise HTTPException(422, "Não há vendas no banco para treinar.")
            previsor, _ = treinar_previsor(series, iteracoes=pedido.iteracoes)
            ARQ_MODELO.parent.mkdir(parents=True, exist_ok=True)
            joblib.dump(previsor, ARQ_MODELO)
            ARQ_METADADOS.write_text(json.dumps(previsor.metadados, indent=2, ensure_ascii=False),
                                     encoding="utf-8")
        estado.previsor = previsor
        _atualizar_info_modelo()
        TREINOS.labels(resultado="ok").inc()
        return previsor.metadados
    except Exception:
        TREINOS.labels(resultado="erro").inc()
        raise
    finally:
        estado.trava.release()
