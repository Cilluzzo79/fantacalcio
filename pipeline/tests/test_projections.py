import pytest
from fantapipe.career import SeasonStats
from fantapipe.projections import project, project_from_qta


def mk(rating=7.0, gol=0, assist=0, amm=0, esp=0, pg=34, minuti=3060,
       coeff=1.0, torneo="Serie A", gs=None, cs=None, rp=None):
    return SeasonStats(season="25/26", torneo=torneo, coeff=coeff, pg=pg,
                       min=minuti, gol=gol, assist=assist, amm=amm, esp=esp,
                       rating=rating, rig_calc=0, rig_segn=0,
                       gol_subiti=gs, clean_sheet=cs, rig_parati=rp,
                       rig_subiti_affrontati=None)


def test_una_stagione_movimento_calcolo_a_mano():
    # rating 6.95 -> voto 6.0; 17 gol/34 pg = 0.5 gol_pg -> +1.5
    # 3.4 amm/34 = 0.1 -> -0.05 ; fm = 6.0 + 1.5 - 0.05 = 7.45
    p = project([mk(rating=6.95, gol=17, amm=3.4)], "A")
    assert p.voto_proj == pytest.approx(6.0, abs=0.01)
    assert p.fm_proj == pytest.approx(7.45, abs=0.02)
    # starts_share = 3060/3420 = 0.8947 ; value = 1.45 * 0.8947 * 38 = 49.3
    assert p.starts_share == pytest.approx(0.8947, abs=0.001)
    assert p.value_score == pytest.approx(49.3, abs=0.2)


def test_recency_pesa_ultima_stagione():
    buona_recente = project([mk(rating=7.3), mk(rating=6.6)], "C")
    buona_vecchia = project([mk(rating=6.6), mk(rating=7.3)], "C")
    assert buona_recente.fm_proj > buona_vecchia.fm_proj


def test_coeff_lega_riscala_i_gol():
    in_serie_a = project([mk(gol=10)], "A")
    in_eredivisie = project([mk(gol=10, coeff=0.75, torneo="Eredivisie")], "A")
    assert in_serie_a.fm_proj > in_eredivisie.fm_proj


def test_stagione_con_poche_presenze_scartata():
    p_solo_buona = project([mk(rating=7.2)], "C")
    p_con_spezzone = project([mk(rating=7.2), mk(rating=5.5, pg=3, minuti=200)], "C")
    assert p_con_spezzone.fm_proj == pytest.approx(p_solo_buona.fm_proj, abs=0.01)


def test_portiere():
    # voto 6.0; gs 34/34=1 -> -1 ; cs 10/34=0.294 -> +0.294 ; rp 3/34 -> +0.26
    p = project([mk(rating=6.95, gs=34, cs=10, rp=3)], "P")
    assert p.fm_proj == pytest.approx(6.0 - 1 + 0.294 + 0.265, abs=0.02)


def test_value_score_mai_negativo():
    p = project([mk(rating=5.8, amm=10)], "D")
    assert p.value_score == 0.0


def test_fallback_da_quotazione():
    p = project_from_qta(20, "A")
    assert p.value_score == pytest.approx(16.0)
    assert 6.0 < p.fm_proj < 7.0


def test_carriera_vuota_solleva():
    with pytest.raises(ValueError):
        project([], "A")
