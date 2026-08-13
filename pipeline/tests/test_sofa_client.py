import json
import subprocess
import pytest
from fantapipe import sofa_client
from fantapipe.sofa_client import SofaCliError


class FakeCompleted:
    def __init__(self, stdout, returncode=0, stderr=""):
        self.stdout, self.returncode, self.stderr = stdout, returncode, stderr


def test_run_cli_parses_json(monkeypatch):
    captured = {}

    def fake_run(cmd, **kw):
        captured["cmd"] = cmd
        return FakeCompleted(json.dumps({"ok": 1}))

    monkeypatch.setattr(subprocess, "run", fake_run)
    out = sofa_client.run_cli(["version"])
    assert out == {"ok": 1}
    assert "--agent" in captured["cmd"]          # sempre modalità agent
    assert captured["cmd"][0].endswith("sofascore-pp-cli.exe")


def test_run_cli_respects_call_spacing(monkeypatch):
    # CALL_SPACING_S e' azzerato globalmente da tests/conftest.py; qui lo si
    # rialza localmente per verificare che run_cli lo rispetti davvero e che
    # sia effettivamente patchabile (requisito M2).
    monkeypatch.setattr(sofa_client, "CALL_SPACING_S", 0.02)
    slept = []
    monkeypatch.setattr(sofa_client.time, "sleep", lambda s: slept.append(s))
    monkeypatch.setattr(subprocess, "run",
                        lambda cmd, **kw: FakeCompleted(json.dumps({"ok": 1})))
    sofa_client.run_cli(["version"])
    assert slept == [0.02]


def test_run_cli_raises_on_error(monkeypatch):
    monkeypatch.setattr(subprocess, "run",
                        lambda cmd, **kw: FakeCompleted("", 1, "boom"))
    with pytest.raises(SofaCliError):
        sofa_client.run_cli(["player", "999"])


def test_get_team_squad_unwraps_players(monkeypatch):
    # Shape reale scoperta nello Step 1/6: la lista piatta dei giocatori vive
    # in results.players (non in un "players" top-level, come inizialmente
    # ipotizzato nel brief).
    payload = {"results": {"players": [{"player": {"id": 1, "name": "A", "position": "M"}}]}}
    monkeypatch.setattr(sofa_client, "run_cli", lambda args: payload)
    squad = sofa_client.get_team_squad(42)
    assert squad[0]["player"]["name"] == "A"


def test_search_team_returns_first_team_id(monkeypatch):
    payload = {"results": [
        {"type": "team", "entity": {"id": 2697, "name": "Inter"}},
        {"type": "player", "entity": {"id": 5, "name": "Interisti FC"}},
    ]}
    monkeypatch.setattr(sofa_client, "run_cli", lambda args: payload)
    assert sofa_client.search_team("Inter") == 2697


def test_search_team_none_when_missing(monkeypatch):
    monkeypatch.setattr(sofa_client, "run_cli", lambda args: {"results": []})
    assert sofa_client.search_team("Sconosciuta") is None


def test_get_player_unwraps_player_envelope(monkeypatch):
    # Shape reale: {"meta": {...}, "results": {"player": {...}}}
    payload = {"meta": {"source": "live"},
               "results": {"player": {"id": 363856, "name": "Nicolo Barella", "position": "M"}}}
    monkeypatch.setattr(sofa_client, "run_cli", lambda args: payload)
    player = sofa_client.get_player(363856)
    assert player == {"id": 363856, "name": "Nicolo Barella", "position": "M"}


def test_get_player_raises_on_unexpected_shape(monkeypatch):
    # results presente ma senza la chiave "player": non deve restituire
    # silenziosamente l'intero envelope come se fosse il player.
    monkeypatch.setattr(sofa_client, "run_cli", lambda args: {"results": {"oops": {}}})
    with pytest.raises(SofaCliError):
        sofa_client.get_player(363856)


def test_get_player_raises_when_results_missing(monkeypatch):
    # Nessuna chiave "results" affatto.
    monkeypatch.setattr(sofa_client, "run_cli", lambda args: {"unexpected": True})
    with pytest.raises(SofaCliError):
        sofa_client.get_player(363856)


def test_get_player_seasons_unwraps_unique_tournament_seasons(monkeypatch):
    # Shape reale: {"meta": {...}, "results": {"typesMap": {...},
    # "uniqueTournamentSeasons": [{"uniqueTournament": {...}, "seasons": [...]}]}}
    seasons = [{"uniqueTournament": {"id": 23, "name": "Serie A"},
                "seasons": [{"id": 76457, "year": "25/26"}]}]
    payload = {"meta": {"source": "live"},
               "results": {"typesMap": {}, "uniqueTournamentSeasons": seasons}}
    monkeypatch.setattr(sofa_client, "run_cli", lambda args: payload)
    assert sofa_client.get_player_seasons(363856) == seasons


def test_get_player_seasons_raises_on_unexpected_shape(monkeypatch):
    # results presente ma senza "uniqueTournamentSeasons".
    monkeypatch.setattr(sofa_client, "run_cli", lambda args: {"results": {"typesMap": {}}})
    with pytest.raises(SofaCliError):
        sofa_client.get_player_seasons(363856)


def test_get_player_season_stats_unwraps_statistics_envelope(monkeypatch):
    # Shape reale (scoperta 2026-08-13, nuovo endpoint CLI
    # `player statistics get-player-season-statistics`):
    # {"meta": {...}, "results": {"statistics": {...}, "team": {...}}}
    payload = {"meta": {"source": "live"},
               "results": {"statistics": {"appearances": 30, "goals": 5},
                           "team": {"id": 2697, "name": "Inter"}}}
    monkeypatch.setattr(sofa_client, "run_cli", lambda args: payload)
    stats = sofa_client.get_player_season_stats(363856, 23, 76457)
    assert stats == {"appearances": 30, "goals": 5}


def test_get_player_season_stats_raises_on_unexpected_shape(monkeypatch):
    # results presente ma senza "statistics": non deve restituire
    # silenziosamente l'intero envelope come se fosse le statistiche.
    monkeypatch.setattr(sofa_client, "run_cli", lambda args: {"results": {"team": {}}})
    with pytest.raises(SofaCliError):
        sofa_client.get_player_season_stats(363856, 23, 76457)


def test_get_player_season_stats_raises_when_results_missing(monkeypatch):
    monkeypatch.setattr(sofa_client, "run_cli", lambda args: {"unexpected": True})
    with pytest.raises(SofaCliError):
        sofa_client.get_player_season_stats(363856, 23, 76457)
