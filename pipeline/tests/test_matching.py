import pandas as pd
from fantapipe import matching


def _listone(rows):
    return pd.DataFrame(rows, columns=["id", "nome", "ruolo", "squadra", "qta", "fvm"])


INDEX = {"Inter": [{"sofaId": 1, "nome": "Nicolò Barella"},
                   {"sofaId": 2, "nome": "Lautaro Martínez"},
                   {"sofaId": 3, "nome": "Federico Dimarco"}],
         "Napoli": [{"sofaId": 9, "nome": "Alex Meret"}]}


def test_normalize_name():
    assert matching.normalize_name("Lautaro Martínez") == "lautaro martinez"
    assert matching.normalize_name("MARTINEZ L.") == "martinez l"


def test_match_exact_cognome():
    df = matching.match_players(_listone([[10, "Barella", "C", "Inter", 28, 120]]),
                                INDEX, {})
    assert df.iloc[0].sofa_id == 1 and df.iloc[0].match_status in ("exact", "fuzzy")


def test_match_fuzzy_con_iniziale():
    df = matching.match_players(_listone([[11, "Martinez L.", "A", "Inter", 34, 200]]),
                                INDEX, {})
    assert df.iloc[0].sofa_id == 2


def test_override_vince():
    df = matching.match_players(_listone([[12, "Barella", "C", "Inter", 28, 120]]),
                                INDEX, {12: 3})
    assert df.iloc[0].sofa_id == 3 and df.iloc[0].match_status == "override"


def test_nessun_match_resta_nan():
    df = matching.match_players(_listone([[13, "Sconosciuto", "A", "Napoli", 5, 10]]),
                                INDEX, {})
    assert pd.isna(df.iloc[0].sofa_id) and df.iloc[0].match_status == "nessuno"


def test_squadra_fuori_indice_va_in_nessuno():
    df = matching.match_players(_listone([[14, "Tizio", "D", "Pisa", 4, 8]]),
                                {"Inter": INDEX["Inter"]}, {})
    assert df.iloc[0].match_status == "nessuno"


def test_build_sofa_index_con_client_finto():
    class FakeClient:
        def search_team(self, name):
            return {"Inter": 100}.get(name)
        def get_team_squad(self, team_id):
            return [{"player": {"id": 1, "name": "Nicolò Barella", "position": "M"}}]
    idx, warns = matching.build_sofa_index(["Inter", "AtlantideFC"], client=FakeClient())
    assert idx["Inter"][0]["nome"] == "Nicolò Barella"
    assert idx["AtlantideFC"] == [] and any("AtlantideFC" in w for w in warns)


def test_report_scrive_dubbi(tmp_path):
    df = matching.match_players(_listone([[13, "Sconosciuto", "A", "Napoli", 5, 10]]),
                                INDEX, {})
    out = tmp_path / "report.csv"
    matching.write_report(df, out)
    assert "Sconosciuto" in out.read_text(encoding="utf-8")
