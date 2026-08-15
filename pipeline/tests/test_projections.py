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
    # starts_share = 3060/3420 = 0.8947; shrinkage: 34 pg totali -> lambda
    # 34/60 = 0.5667; value = (7.45-5.0) * 0.8947 * 0.5667 * 38 = 47.2
    assert p.starts_share == pytest.approx(0.8947, abs=0.001)
    assert p.value_score == pytest.approx(47.2, abs=0.3)


def test_shrinkage_sconta_i_campioni_piccoli():
    # Audit 2026-08-15 (Mandas a 48 crediti con 20 presenze in carriera):
    # poche presenze = evidenza debole -> il valore sopra-base si sconta con
    # lambda = min(1, pg_tot/60).
    poco = project([mk(rating=7.1, gol=10, pg=20, minuti=1800)], "A")
    pieno = project([mk(rating=7.1, gol=10, pg=20, minuti=1800)] * 3, "A")
    assert poco.value_score < pieno.value_score * 0.55


def test_shrinkage_nullo_con_campione_pieno():
    # 3 stagioni piene (102 pg) -> lambda 1, nessuno sconto
    p = project([mk(rating=6.95, gol=17, amm=3.4)] * 3, "A")
    assert p.value_score == pytest.approx(83.3, abs=0.3)


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
    # fm sotto la base di ruolo (voto clampato 5.25, malus cartellini
    # pesanti -> fm ~4.9 < base D 5.0): il floor a zero deve reggere
    p = project([mk(rating=5.0, amm=15, esp=3)], "D")
    assert p.value_score == 0.0


def test_portiere_titolare_batte_il_fallback_del_terzo():
    # BUG smoke test 2026-08-15 (De Gea a prezzo 1): con base unica 6.0
    # ogni portiere reale (fm ~5) veniva appiattito a 0 e superato dal
    # fallback qta*0.8 dei terzi portieri. Un titolare con numeri sani
    # deve valere piu' del fallback di un portiere a quotazione 1 (0.8)
    # e piu' anche di un fallback medio (qta 12 -> 9.6).
    de_gea = project([mk(rating=7.0, gs=44, cs=11, rp=1, pg=37, minuti=3330)], "P")
    assert de_gea.value_score > project_from_qta(1, "P").value_score
    assert de_gea.value_score > project_from_qta(12, "P").value_score


def test_stats_portiere_riscalate_per_coefficiente_di_lega():
    # BUG smoke test 2026-08-15 (Thiam, Monza da Serie B, valutato sopra
    # De Gea): il rating veniva riscalato per la lega ma gol subiti, clean
    # sheet e rigori parati NO — 0.84 gs/pg in Serie B contati come Serie A.
    # Attesi in Serie A: gs/coeff (piu' gol subiti), cs*coeff e rp*coeff
    # (meno clean sheet e parate). Stessi numeri grezzi, lega piu' debole
    # -> valore nettamente inferiore.
    in_serie_a = project([mk(rating=7.1, gs=32, cs=16, rp=1, pg=38,
                             minuti=3420)], "P")
    in_serie_b = project([mk(rating=7.1, gs=32, cs=16, rp=1, pg=38,
                             minuti=3420, coeff=0.65, torneo="Serie B")], "P")
    assert in_serie_b.fm_proj < in_serie_a.fm_proj - 0.4
    assert in_serie_b.value_score < in_serie_a.value_score * 0.75


def test_portieri_reali_si_differenziano():
    forte = project([mk(rating=7.2, gs=30, cs=15, rp=2)], "P")
    debole = project([mk(rating=6.6, gs=55, cs=4, rp=0)], "P")
    assert forte.value_score > debole.value_score > 0.0


def test_qta_alza_la_titolarita_attesa_dei_nuovi_titolari():
    # BUG smoke test 2026-08-15 (Simeone qta 57 a prezzo 1): il modello
    # proiettava la titolarita' SOLO dai minuti storici, azzerando i
    # titolari attesi reduci da stagioni in rotazione. La qta Gazzetta fa
    # da proxy delle "gerarchie di squadra" (spec 5.A.2): share attesa =
    # max(storica, min(0.85, qta/30)).
    rotazione = [mk(rating=6.9, gol=8, pg=25, minuti=1400)]
    con_qta = project(rotazione, "A", qta=57)
    senza_qta = project(rotazione, "A")
    assert con_qta.starts_share == pytest.approx(0.85, abs=0.001)
    assert con_qta.value_score > senza_qta.value_score


def test_qta_bassa_non_gonfia_le_riserve():
    riserva = [mk(rating=6.6, pg=10, minuti=500)]
    con = project(riserva, "D", qta=1)
    senza = project(riserva, "D")
    assert con.value_score == pytest.approx(senza.value_score)
    assert con.starts_share == pytest.approx(senza.starts_share)


def test_qta_non_abbassa_mai_la_titolarita_storica():
    titolare = [mk(rating=7.0, pg=36, minuti=3300)]
    con = project(titolare, "C", qta=6)
    senza = project(titolare, "C")
    assert con.starts_share == pytest.approx(senza.starts_share)


def test_fallback_da_quotazione():
    p = project_from_qta(20, "A")
    assert p.value_score == pytest.approx(16.0)
    assert 6.0 < p.fm_proj < 7.0


def test_carriera_vuota_solleva():
    with pytest.raises(ValueError):
        project([], "A")


def test_portiere_scarta_stagione_senza_gol_subiti():
    # Una stagione con presenze ma gol_subiti mancante (buco nei dati) non
    # deve essere usata come se avesse subito 0 gol: va scartata, restando
    # solo la stagione completa.
    completa = mk(rating=6.95, gs=34, cs=10, rp=3)
    incompleta = mk(rating=9.0, gs=None, cs=None, rp=None)  # rating estremo
    p_solo_completa = project([completa], "P")
    p_con_incompleta = project([completa, incompleta], "P")
    assert p_con_incompleta.fm_proj == pytest.approx(p_solo_completa.fm_proj, abs=0.01)


def test_portiere_tutte_stagioni_senza_gol_subiti_solleva():
    with pytest.raises(ValueError):
        project([mk(gs=None, cs=None, rp=None)], "P")
