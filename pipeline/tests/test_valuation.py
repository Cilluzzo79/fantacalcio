import pandas as pd
from fantapipe.valuation import assign_fasce, affidabilita
from fantapipe.career import SeasonStats


def mk(torneo="Serie A", minuti=3000):
    return SeasonStats(season="25/26", torneo=torneo, coeff=1.0, pg=34,
                       min=minuti, gol=0, assist=0, amm=0, esp=0, rating=7.0,
                       rig_calc=0, rig_segn=0, gol_subiti=None,
                       clean_sheet=None, rig_parati=None,
                       rig_subiti_affrontati=None)


def test_fasce_percentili_per_ruolo():
    df = pd.DataFrame({
        "ruolo": ["A"] * 100,
        "value_score": [float(i) for i in range(100)],
    })
    fasce = assign_fasce(df)
    assert fasce.iloc[99] == "top"
    assert fasce.iloc[95] == "semitop"
    assert fasce.iloc[80] == "titolare"
    assert fasce.iloc[50] == "scommessa"
    assert fasce.iloc[10] == "lowcost"


def test_fasce_indipendenti_tra_ruoli():
    df = pd.DataFrame({
        "ruolo": ["A"] * 50 + ["P"] * 50,
        "value_score": [float(i) for i in range(50)] + [float(i) for i in range(50)],
    })
    fasce = assign_fasce(df)
    # il miglior portiere è top anche se i suoi score assoluti sono uguali agli attaccanti
    assert fasce.iloc[99] == "top" and fasce.iloc[49] == "top"


def test_affidabilita_matchato_pieno():
    assert affidabilita([mk(), mk(), mk()], matched=True) == 100


def test_affidabilita_dubbio_penalizzato():
    assert affidabilita([mk(), mk(), mk()], matched=True, dubbio=True) == 85


def test_affidabilita_non_matchato():
    assert affidabilita([], matched=False) <= 40


def test_affidabilita_senza_serie_a():
    v = affidabilita([mk(torneo="Premier League"), mk(torneo="Premier League")],
                     matched=True)
    assert v == 80


def test_affidabilita_minutaggio_basso():
    pieno = affidabilita([mk(minuti=3400), mk()], matched=True)
    scarso = affidabilita([mk(minuti=800), mk()], matched=True)
    assert scarso < pieno


def test_clamp_minimo_5():
    assert affidabilita([], matched=False) >= 5
