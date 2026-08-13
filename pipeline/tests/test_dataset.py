import json
import pandas as pd
from fantapipe import dataset
from fantapipe.career import SeasonStats


def _matched_df():
    return pd.DataFrame({
        "id": [1, 2, 3, 4],
        "nome": ["Barella", "Meret", "Bastoni", "Kean"],
        "ruolo": ["C", "P", "D", "A"],
        "squadra": ["Inter", "Napoli", "Inter", "Fiorentina"],
        "qta": [28, 12, 20, 22],
        "fvm": [120, 40, 90, 100],
        "sofa_id": pd.array([100, 101, 102, pd.NA], dtype="Int64"),
        "match_status": ["exact", "fuzzy", "exact", "nessuno"],
    })


def _career():
    return [SeasonStats(season="25/26", torneo="Serie A", coeff=1.0, pg=34,
                        min=3000, gol=4, assist=8, amm=5, esp=0, rating=7.2,
                        rig_calc=0, rig_segn=0, gol_subiti=None,
                        clean_sheet=None, rig_parati=None,
                        rig_subiti_affrontati=None)]


def _build():
    careers = {100: _career(), 101: _career(), 102: _career()}
    return dataset.build_dataset(_matched_df(), careers, "2026-27",
                                 "quot.xlsx", "2026-08-12T07:00:00+00:00")


def test_struttura_e_contratto():
    ds = _build()
    assert ds["schemaVersion"] == 1 and ds["season"] == "2026-27"
    assert len(ds["players"]) == 4
    p = ds["players"][0]
    for k in ("id", "sofaId", "nome", "ruolo", "squadra", "qta", "fvm", "fascia",
              "valueScore", "fmProj", "votoProj", "startsShare", "affidabilita",
              "traits", "note", "seasons"):
        assert k in p, k


def test_non_matchato_fallback():
    ds = _build()
    kean = [p for p in ds["players"] if p["nome"] == "Kean"][0]
    assert kean["sofaId"] is None and kean["seasons"] == []
    assert kean["affidabilita"] <= 40 and kean["valueScore"] > 0


def test_dubbio_riflesso_in_affidabilita():
    full_career = [SeasonStats(season="25/26", torneo="Serie A", coeff=1.0, pg=34,
                               min=3000, gol=4, assist=8, amm=5, esp=0, rating=7.2,
                               rig_calc=0, rig_segn=0, gol_subiti=None,
                               clean_sheet=None, rig_parati=None,
                               rig_subiti_affrontati=None)] * 2
    matched_df = pd.DataFrame({
        "id": [1], "nome": ["Barella"], "ruolo": ["C"], "squadra": ["Inter"],
        "qta": [28], "fvm": [120],
        "sofa_id": pd.array([100], dtype="Int64"),
        "match_status": ["dubbio"],
    })
    ds = dataset.build_dataset(matched_df, {100: full_career}, "2026-27",
                               "quot.xlsx", "2026-08-12T07:00:00+00:00")
    assert ds["players"][0]["affidabilita"] == 85  # 100 - 15 dubbio


def test_validate_ok():
    assert dataset.validate_dataset(_build()) == []


def test_validate_trova_problemi():
    ds = _build()
    ds["players"][0]["valueScore"] = -1
    ds["players"][1]["fascia"] = "media"
    problems = dataset.validate_dataset(ds)
    assert len(problems) >= 2


def test_write_utf8(tmp_path):
    out = tmp_path / "dataset.json"
    dataset.write_dataset(_build(), out)
    loaded = json.loads(out.read_text(encoding="utf-8"))
    assert loaded["players"][0]["nome"] == "Barella"
