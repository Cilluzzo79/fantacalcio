import json
from openpyxl import Workbook
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
        return {"statistics": {"appearances": 34, "minutesPlayed": 3000,
                               "goals": 4, "assists": 6, "yellowCards": 3,
                               "redCards": 0, "rating": 7.0,
                               "penaltiesTaken": 0, "penaltyGoals": 0}}


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
