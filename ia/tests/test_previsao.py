import pandas as pd
import pytest

from previsao import dados
from previsao.avaliacao import metricas, validar
from previsao.modelos import BaselineMediaMovel, ModeloPrincipal, Previsor
from previsao.sinteticos import gerar_vendas


def test_csv_exportado_pela_tela_de_vendas(tmp_path):
    arquivo = tmp_path / "vendas.csv"
    arquivo.write_text(
        '﻿"Data","Cliente","Receita","Quantidade","Preço Unitário","Valor Total","Pago",'
        '"Entregue","Forma de Pagamento","Observações","Usuário"\n'
        '"06/01/2025, 19:30:00","Ana","Calabresa","2.000","45.00","90.00","SIM","SIM","Pix","","Admin"\n'
        '"13/01/2025, 20:00:00","Bruno","Margherita","1.000","42.00","42.00","NÃO","NÃO","","","Admin"\n',
        encoding="utf-8")
    vendas = dados.carregar_vendas_csv(arquivo)
    assert list(vendas["sabor"]) == ["Calabresa", "Margherita"]
    assert vendas["data"].iloc[0] == pd.Timestamp("2025-01-06 19:30")
    assert vendas["quantidade"].sum() == 3


def test_series_semanais_preenche_zeros_e_ignora_semana_incompleta():
    vendas = dados.normalizar_vendas(pd.DataFrame({
        "data": ["2025-01-06", "2025-01-08", "2025-01-21", "2025-01-29"],
        "sabor": ["Calabresa"] * 4,
        "quantidade": [2, 3, 4, 9],
    }))
    series = dados.series_semanais(vendas)
    # 29/01 (quarta) está numa semana ainda aberta e fica de fora
    assert list(series["semana"].dt.strftime("%Y-%m-%d")) == ["2025-01-06", "2025-01-13", "2025-01-20"]
    assert list(series["quantidade"]) == [5, 0, 4]


def test_url_do_prisma_vira_pymysql():
    assert dados._url_sqlalchemy('"mysql://u:p@db:3306/x"') == "mysql+pymysql://u:p@db:3306/x"


def test_baseline_media_das_ultimas_4_semanas():
    prev = BaselineMediaMovel().prever_serie(pd.Series([100, 1, 2, 3, 6]), horizonte=2)
    assert list(prev) == [3.0, 3.0]


def test_metricas():
    m = metricas([10, 0], [8, 2])
    assert m["mae"] == 2 and m["rmse"] == 2 and m["wape"] == pytest.approx(0.4)


@pytest.fixture(scope="module")
def series():
    return dados.series_semanais(dados.normalizar_vendas(gerar_vendas(semanas=60)))


def test_validacao_e_previsao(series):
    resultado = validar(series)
    assert resultado["linhas_teste"] == 8 * series["sabor"].nunique()
    principal = ModeloPrincipal().treinar(series)
    previsao = Previsor(principal=principal).prever(series, horizonte=3)
    assert len(previsao) == 3 * series["sabor"].nunique()
    assert (previsao["previsao"] >= 0).all()
    assert set(previsao["metodo"]) == {principal.nome}


def test_sabor_novo_usa_baseline(series):
    principal = ModeloPrincipal().treinar(series)
    ultima = series["semana"].max()
    novo = pd.DataFrame({
        "semana": [ultima - pd.Timedelta(weeks=i) for i in (2, 1, 0)],
        "sabor": "Sabor Novo",
        "quantidade": [3.0, 5.0, 4.0],
    })
    previsao = Previsor(principal=principal).prever(pd.concat([series, novo]))
    linha = previsao[previsao["sabor"] == "Sabor Novo"].iloc[0]
    assert linha["metodo"] == BaselineMediaMovel.nome
    assert linha["previsao"] == 4.0


def test_intervalo_contem_a_previsao_e_alarga_com_o_horizonte(series):
    previsor = Previsor(principal=ModeloPrincipal().treinar(series))
    p = previsor.prever(series[series["sabor"] == "Calabresa"], horizonte=3)
    assert (p["limite_inferior"] <= p["previsao"]).all()
    assert (p["previsao"] <= p["limite_superior"]).all()
    larguras = (p["limite_superior"] - p["limite_inferior"]).to_numpy()
    assert larguras[2] > larguras[0]


def test_datas_utc_do_banco_viram_horario_local():
    # domingo 23h em São Paulo = segunda 02h UTC; a venda deve cair na semana do domingo
    vendas = dados.normalizar_vendas(pd.DataFrame({
        "data": pd.to_datetime(["2025-01-13 02:00"]).tz_localize("UTC"),
        "sabor": ["Calabresa"], "quantidade": [1],
    }))
    assert vendas["data"].iloc[0] == pd.Timestamp("2025-01-12 23:00")


def test_series_ate_preenche_semanas_sem_venda():
    vendas = dados.normalizar_vendas(pd.DataFrame({
        "data": ["2025-01-06"], "sabor": ["Calabresa"], "quantidade": [2]}))
    series = dados.series_semanais(vendas, ate=pd.Timestamp("2025-01-26"))
    assert list(series["quantidade"]) == [2, 0, 0]
