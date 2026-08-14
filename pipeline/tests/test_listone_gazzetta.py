from pathlib import Path

import pytest

from fantapipe.listone_gazzetta import (GazzettaError, KNOWN_TEAMS,
                                        load_listone_gazzetta, parse_entries,
                                        stable_id, to_listone_df)

# righe già ricostruite in ordine di lettura (colonna sx poi dx, pagina per pagina)
LINES = [
    "IL LISTONE",
    "Portieri",
    "Nome Squadra Costo (Fantamilioni)",
    "MAIGNAN Milan 34",
    "DE GEA Fiorentina 24",
    "fantacampionato.gazzetta.it",
    "Difensori",
    "Nome Squadra Costo (Fantamilioni)",
    "CARLOS AUGUSTO Internazionale 24",
    "CANDÈ Sassuolo 8",
    "CARBONI Monza 10",
    "CARBONI Parma 6",
    "Centrocampisti",
    "ZACCAGNI Lazio 22",
    "Attaccanti",
    "LAUTARO MARTINEZ Internazionale 36",
    "Allenatori",
    "CHIVU Inter 30",
    "fantacampionato.gazzetta.it",
]


def test_parse_entries_assigns_ruolo_from_section():
    players, _ = parse_entries(LINES)
    by_name = {p["nome"]: p for p in players}
    assert by_name["MAIGNAN"]["ruolo"] == "P"
    assert by_name["CANDÈ"]["ruolo"] == "D"
    assert by_name["ZACCAGNI"]["ruolo"] == "C"
    assert by_name["LAUTARO MARTINEZ"]["ruolo"] == "A"


def test_parse_entries_parses_multiword_names_and_costo():
    players, _ = parse_entries(LINES)
    carlos = next(p for p in players if p["nome"] == "CARLOS AUGUSTO")
    assert carlos["costo"] == 24
    assert carlos["ruolo"] == "D"


def test_parse_entries_canonicalizes_internazionale_to_inter():
    players, _ = parse_entries(LINES)
    carlos = next(p for p in players if p["nome"] == "CARLOS AUGUSTO")
    assert carlos["squadra"] == "Inter"


def test_parse_entries_coaches_are_separate_not_players():
    players, coaches = parse_entries(LINES)
    assert all(p["nome"] != "CHIVU" for p in players)
    assert coaches == [{"nome": "CHIVU", "squadra": "Inter", "costo": 30}]


def test_parse_entries_skips_headers_and_footer():
    players, coaches = parse_entries(LINES)
    names = {p["nome"] for p in players} | {c["nome"] for c in coaches}
    assert not any("LISTONE" in n or "Squadra" in n or "gazzetta" in n
                   for n in names)
    assert len(players) == 8


def test_parse_entries_unknown_team_raises():
    with pytest.raises(GazzettaError, match="sconosciut"):
        parse_entries(["Portieri", "ROSSI Interstellar 5"])


def test_parse_entries_entry_before_section_raises():
    with pytest.raises(GazzettaError, match="sezione"):
        parse_entries(["MAIGNAN Milan 34"])


def test_stable_id_is_deterministic_positive_and_distinct():
    a = stable_id("D", "CARBONI", "Monza")
    b = stable_id("D", "CARBONI", "Parma")
    assert a == stable_id("D", "CARBONI", "Monza")
    assert a != b
    assert a > 0 and b > 0


def test_to_listone_df_matches_loader_contract():
    players, _ = parse_entries(LINES)
    df = to_listone_df(players)
    assert list(df.columns) == ["id", "nome", "ruolo", "squadra", "qta", "fvm"]
    maignan = df[df.nome == "MAIGNAN"].iloc[0]
    assert maignan.qta == 34 and maignan.fvm == 34
    assert df.id.is_unique
    assert str(df.id.dtype) == "int64"


def test_to_listone_df_twin_entries_get_disambiguated():
    # caso reale: i gemelli Oyono, entrambi "OYONO Frosinone" difensori
    players = [{"nome": "OYONO", "ruolo": "D", "squadra": "Frosinone",
                "costo": 12},
               {"nome": "OYONO", "ruolo": "D", "squadra": "Frosinone",
                "costo": 8}]
    df = to_listone_df(players)
    assert list(df.nome) == ["OYONO", "OYONO (2)"]
    assert df.id.is_unique
    assert list(df.qta) == [12, 8]


def test_to_listone_df_more_than_two_same_entries_raise():
    players = [{"nome": "ROSSI", "ruolo": "D", "squadra": "Milan", "costo": c}
               for c in (5, 7, 9)]
    with pytest.raises(GazzettaError, match="duplicat"):
        to_listone_df(players)


# ---- integrazione sul PDF reale (skip se non scaricato) ----

REAL_PDF = Path(__file__).resolve().parents[1] / "data" / "listone" / \
    "listone_gazzetta_2026-08-14.pdf"


@pytest.mark.skipif(not REAL_PDF.exists(), reason="PDF reale non presente")
def test_load_real_pdf_full_contract():
    df, coaches = load_listone_gazzetta(REAL_PDF)
    assert 550 <= len(df) <= 750
    assert set(df.ruolo.unique()) == {"P", "D", "C", "A"}
    assert set(df.squadra.unique()) == set(KNOWN_TEAMS)
    assert df.id.is_unique
    assert int(df.qta.min()) >= 1
    maignan = df[(df.nome == "MAIGNAN") & (df.squadra == "Milan")].iloc[0]
    assert maignan.ruolo == "P" and maignan.qta == 34
    carlos = df[df.nome == "CARLOS AUGUSTO"]
    assert len(carlos) == 1 and carlos.iloc[0].squadra == "Inter"
    # i gemelli Oyono restano entrambi, disambiguati
    assert (df.nome == "OYONO").sum() == 1
    assert (df.nome == "OYONO (2)").sum() == 1
    assert len(coaches) == 20
    assert {c["squadra"] for c in coaches} == set(KNOWN_TEAMS)
    chivu = next(c for c in coaches if c["nome"] == "CHIVU")
    assert chivu == {"nome": "CHIVU", "squadra": "Inter", "qta": 30}
