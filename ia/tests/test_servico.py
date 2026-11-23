import pandas as pd
import pytest
from fastapi.testclient import TestClient

from previsao import dados
from previsao.sinteticos import gerar_vendas
from previsao.treino import treinar_previsor
from servico import app as servico

CHAVE = "chave-de-teste"


@pytest.fixture(scope="module")
def vendas():
    return dados.normalizar_vendas(gerar_vendas(semanas=40))


@pytest.fixture()
def cliente(monkeypatch, tmp_path):
    monkeypatch.setenv("IA_API_KEY", CHAVE)
    monkeypatch.setattr(servico, "ARQ_MODELO", tmp_path / "previsor.joblib")
    monkeypatch.setattr(servico, "ARQ_METADADOS", tmp_path / "metadados.json")
    with TestClient(servico.app) as c:
        yield c


def _corpo(vendas, **extra):
    lista = [{"data": d.isoformat(), "sabor": s, "quantidade": q}
             for d, s, q in vendas.itertuples(index=False)]
    return {"vendas": lista, **extra}


def test_saude_sem_chave(cliente):
    r = cliente.get("/saude")
    assert r.status_code == 200
    assert r.json()["modelo_ativo"] == "baseline_media_movel_4"


def test_rotas_protegidas_exigem_chave(cliente, vendas):
    assert cliente.get("/modelo").status_code == 401
    assert cliente.post("/previsao", json={}, headers={"X-API-Key": "errada"}).status_code == 401


def test_sem_chave_configurada_falha_fechado(cliente, monkeypatch):
    monkeypatch.delenv("IA_API_KEY")
    assert cliente.get("/modelo", headers={"X-API-Key": ""}).status_code == 503


def test_previsao_com_vendas_no_corpo(cliente, vendas):
    r = cliente.post("/previsao", headers={"X-API-Key": CHAVE},
                     json=_corpo(vendas, semanas=2, sabores=["Calabresa", "Margherita"]))
    assert r.status_code == 200, r.text
    corpo = r.json()
    assert {p["sabor"] for p in corpo["previsoes"]} == {"Calabresa", "Margherita"}
    assert len(corpo["previsoes"]) == 4
    assert all(p["limite_inferior"] <= p["previsao"] <= p["limite_superior"] for p in corpo["previsoes"])
    assert corpo["nivel_confianca"] == 0.8


def test_previsao_ate_uma_data(cliente, vendas):
    ate = (vendas["data"].min() + pd.Timedelta(weeks=10)).date()
    r = cliente.post("/previsao", headers={"X-API-Key": CHAVE},
                     json=_corpo(vendas, ate=ate.isoformat()))
    assert r.status_code == 200, r.text
    ultima = pd.Timestamp(r.json()["ultima_semana_historico"])
    assert ultima <= pd.Timestamp(ate) < ultima + pd.Timedelta(weeks=1)


def test_validacao_do_pedido(cliente):
    r = cliente.post("/previsao", headers={"X-API-Key": CHAVE}, json={"semanas": 99})
    assert r.status_code == 422


def test_treinar_le_do_banco_e_troca_o_modelo(cliente, vendas, monkeypatch):
    monkeypatch.setattr(dados, "carregar_vendas_banco", lambda: vendas)
    r = cliente.post("/treinar", headers={"X-API-Key": CHAVE}, json={"iteracoes": 2})
    assert r.status_code == 200, r.text
    assert servico.ARQ_MODELO.exists()
    meta = cliente.get("/modelo", headers={"X-API-Key": CHAVE}).json()
    assert meta["semanas"] == r.json()["semanas"]
    r = cliente.post("/previsao", headers={"X-API-Key": CHAVE}, json={"semanas": 1})
    assert r.status_code == 200
    assert len(r.json()["previsoes"]) == vendas["sabor"].nunique()


def test_metricas_expostas_para_o_prometheus(cliente, vendas):
    cliente.post("/previsao", headers={"X-API-Key": CHAVE}, json=_corpo(vendas, semanas=1))
    r = cliente.get("/metrics")
    assert r.status_code == 200
    assert "fredda_ia_previsoes_total" in r.text
    assert 'fredda_ia_modelo_info{modelo_ativo="baseline_media_movel_4"' in r.text
    assert 'handler="/previsao"' in r.text


def test_banco_indisponivel_responde_503(cliente, monkeypatch):
    def falha():
        raise RuntimeError("sem banco")
    monkeypatch.setattr(dados, "carregar_vendas_banco", falha)
    r = cliente.post("/previsao", headers={"X-API-Key": CHAVE}, json={})
    assert r.status_code == 503


def test_ajuste_escolhe_params_e_relatorio_tem_mape():
    series = dados.series_semanais(dados.normalizar_vendas(gerar_vendas(semanas=60)))
    previsor, relatorio = treinar_previsor(series, iteracoes=3)
    assert previsor.metadados["ajuste_iteracoes"] == 3
    assert "MAPE" in relatorio
    assert previsor.metadados["validacao"]["principal"]["mape"] >= 0
    z = previsor.intervalos["hist_gradient_boosting_poisson"]
    assert z["z_inf"] < 0 < z["z_sup"]


def test_historico_curto_fica_so_no_baseline():
    series = dados.series_semanais(dados.normalizar_vendas(gerar_vendas(semanas=6)))
    previsor, relatorio = treinar_previsor(series, iteracoes=2)
    assert relatorio is None
    assert previsor.metadados["modelo_ativo"] == "baseline_media_movel_4"
    assert len(previsor.prever(series)) == series["sabor"].nunique()
