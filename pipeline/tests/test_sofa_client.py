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
