import json
import pytest
from openpyxl import Workbook
import fantapipe.cli
import fantapipe.publish
from fantapipe.cli import run_pipeline


class FakeClient:
    def search_team(self, name):
        return 100
    def get_team_squad(self, team_id):
        return [{"player": {"id": 500, "name": "Nicolò Barella", "position": "M"}},
                {"player": {"id": 501, "name": "Alex Meret", "position": "G"}},
                {"player": {"id": 502, "name": "Alessandro Bastoni", "position": "D"}},
                {"player": {"id": 503, "name": "Moise Kean", "position": "F"}}]
    def get_player_seasons(self, pid):
        return [{"uniqueTournament": {"id": 23, "name": "Serie A"},
                 "seasons": [{"id": 700, "year": "25/26"}]}]
    def get_player_season_stats(self, pid, ut_id, season_id):
        # Il client reale (sofa_client.get_player_season_stats) scompatta
        # gia' l'envelope {"results": {"statistics": {...}}} prima di
        # tornare: qui si restituisce direttamente il dict "statistics"
        # com'e' visto da career.py, senza wrapper aggiuntivo.
        return {"appearances": 34, "minutesPlayed": 3000,
                "goals": 4, "assists": 6, "yellowCards": 3,
                "redCards": 0, "rating": 7.0,
                "penaltiesTaken": 0, "penaltyGoals": 0,
                "goalsConceded": 30, "cleanSheet": 8}


def _make_listone(path):
    wb = Workbook(); ws = wb.active
    ws.append(["Quotazioni 2026-27"])
    ws.append(["Id", "R", "Nome", "Squadra", "Qt.A", "FVM"])
    for row in [[1, "C", "Barella", "Inter", 28, 120],
                [2, "P", "Meret", "Inter", 12, 40],
                [3, "D", "Bastoni", "Inter", 20, 90],
                [4, "A", "Kean", "Inter", 22, 100]]:
        ws.append(row)
    wb.save(path)


def test_run_pipeline_end_to_end(tmp_path):
    listone = tmp_path / "quot.xlsx"
    _make_listone(listone)
    out = tmp_path / "dataset.json"
    pipedata = tmp_path / "pipedata"
    ds = run_pipeline(listone, client=FakeClient(), cache_dir=tmp_path / "cache",
                      out_path=out, now_iso="2026-08-12T07:00:00+00:00", data_dir=pipedata)
    assert out.exists()
    loaded = json.loads(out.read_text(encoding="utf-8"))
    assert len(loaded["players"]) == 4
    assert all(p["sofaId"] is not None for p in loaded["players"])
    assert loaded["generatedAt"] == "2026-08-12T07:00:00+00:00"
    assert loaded["season"] == "2026-27"
    assert (pipedata / "run_log.txt").exists()

    # Il percorso REALE deve essere esercitato: se get_player_season_stats
    # tornasse ancora l'envelope {"statistics": {...}} (bug pre-fix, il
    # client reale lo scompatta gia'), project() troverebbe pg=0 per ogni
    # stagione, cadrebbe sempre sul fallback project_from_qta e queste
    # asserzioni fallirebbero.
    for p in loaded["players"]:
        assert len(p["seasons"]) == 1, p["nome"]
        assert p["startsShare"] == pytest.approx(3000 / 3420, abs=0.01), p["nome"]
        assert p["affidabilita"] > 40, p["nome"]
    by_name = {p["nome"]: p for p in loaded["players"]}
    assert "assistman" in by_name["Barella"]["traits"]
    assert "durevole" in by_name["Barella"]["traits"]
    assert "bonusdifesa" in by_name["Bastoni"]["traits"]


class CareerFailingClient(FakeClient):
    def get_player_seasons(self, pid):
        raise RuntimeError("sofascore down")


def test_run_pipeline_skips_publish_when_coverage_degraded(tmp_path, monkeypatch):
    listone = tmp_path / "quot.xlsx"
    _make_listone(listone)
    out = tmp_path / "dataset.json"
    pipedata = tmp_path / "pipedata"

    def _fail_if_called(*a, **kw):
        raise AssertionError("publish_dataset non doveva essere chiamato")

    monkeypatch.setattr(fantapipe.publish, "publish_dataset", _fail_if_called)

    ds = run_pipeline(listone, client=CareerFailingClient(), cache_dir=tmp_path / "cache",
                      out_path=out, now_iso="2026-08-12T07:00:00+00:00",
                      data_dir=pipedata, publish=True)
    assert len(ds["players"]) == 4
    log = (pipedata / "run_log.txt").read_text(encoding="utf-8")
    assert "publish SALTATO" in log


def test_run_pipeline_writes_run_log_on_validation_failure(tmp_path, monkeypatch):
    listone = tmp_path / "quot.xlsx"
    _make_listone(listone)
    out = tmp_path / "dataset.json"
    pipedata = tmp_path / "pipedata"

    monkeypatch.setattr(fantapipe.cli, "validate_dataset",
                        lambda ds: ["problema finto"])

    with pytest.raises(SystemExit):
        run_pipeline(listone, client=FakeClient(), cache_dir=tmp_path / "cache",
                     out_path=out, now_iso="2026-08-12T07:00:00+00:00",
                     data_dir=pipedata)
    assert not out.exists()  # write_dataset non deve essere raggiunto
    log = (pipedata / "run_log.txt").read_text(encoding="utf-8")
    assert "dataset non valido" in log
    assert "problema finto" in log
