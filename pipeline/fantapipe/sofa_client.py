import json
import subprocess
from fantapipe import config


class SofaCliError(Exception):
    def __init__(self, cmd, returncode, stderr):
        super().__init__(f"sofascore-pp-cli failed ({returncode}): {' '.join(cmd)}\n{stderr}")
        self.cmd, self.returncode, self.stderr = cmd, returncode, stderr


def run_cli(args: list[str]) -> dict | list:
    cmd = [str(config.SOFA_CLI), *args, "--agent"]
    proc = subprocess.run(cmd, capture_output=True, text=True,
                          encoding="utf-8", timeout=120)
    if proc.returncode != 0:
        raise SofaCliError(cmd, proc.returncode, proc.stderr)
    return json.loads(proc.stdout)


# --- Comandi cablati dopo la scoperta dello Step 1 (adatta SOLO queste liste) ---
#
# Scoperta (2026-08-12, via `sofascore-pp-cli --help` / `which` / `api` / esecuzione
# reale con --agent):
# - `player statistics` ha come unico sotto-comando `get-player-seasons`: NESSUN
#   endpoint CLI per le statistiche aggregate di un singolo giocatore in una
#   singola stagione. Confermato anche da `which "player season statistics"` /
#   `which "tournament top players season statistics"`, che indicizzano solo
#   `player statistics get-player-seasons` e `unique-tournament season
#   get-tournament-top-players`.
# - Si usa quindi il FALLBACK documentato nel brief:
#   `unique-tournament season get-tournament-top-players <utId> <seasonId>`
#   (verificato con `--help`: firma `<uniqueTournamentId> <seasonId>`, testato
#   live con ut=23 (Serie A) e season=76457 -> risponde con le classifiche per
#   statistica, vedi nota in fondo al modulo). Il filtro per player_id sui
#   risultati aggregati avviene a valle, in career.py (Task 5).
def _cmd_team_squad(team_id):      return ["team", "players", "get-team", str(team_id)]
def _cmd_search(query):            return ["sofascore-search", "--q", query]
def _cmd_player(player_id):        return ["player", str(player_id)]
def _cmd_player_seasons(player_id):
    return ["player", "statistics", "get-player-seasons", str(player_id)]
def _cmd_player_season_stats(player_id, ut_id, season_id):
    # Fallback: nessun endpoint CLI per season-stats del singolo giocatore
    # (vedi nota sopra). player_id non entra nella chiamata: il filtro
    # avviene a valle sulla lista aggregata restituita.
    return ["unique-tournament", "season", "get-tournament-top-players",
            str(ut_id), str(season_id)]


def get_team_squad(team_id: int) -> list[dict]:
    # Shape reale: {"meta": {...}, "results": {"players": [...], "foreignPlayers": [...], ...}}
    # La lista piatta dell'intera rosa vive in results.players.
    data = run_cli(_cmd_team_squad(team_id))
    return data.get("results", {}).get("players", [])


def search_team(name: str) -> int | None:
    data = run_cli(_cmd_search(name))
    for r in data.get("results", []):
        if r.get("type") == "team":
            return r["entity"]["id"]
    return None


def get_player(player_id: int) -> dict:
    # Shape reale: {"meta": {...}, "results": {"player": {...}}}
    cmd = _cmd_player(player_id)
    data = run_cli(cmd)
    results = data.get("results") if isinstance(data, dict) else None
    if not isinstance(results, dict) or "player" not in results:
        raise SofaCliError(
            cmd, 0,
            f"unexpected response shape for get_player({player_id}): "
            f"expected results.player, got top-level keys "
            f"{list(data.keys()) if isinstance(data, dict) else type(data).__name__}",
        )
    return results["player"]


def get_player_seasons(player_id: int) -> list[dict]:
    # Shape reale: {"meta": {...}, "results": {"typesMap": {...},
    # "uniqueTournamentSeasons": [{"uniqueTournament": {...}, "seasons": [...]}]}}
    cmd = _cmd_player_seasons(player_id)
    data = run_cli(cmd)
    results = data.get("results") if isinstance(data, dict) else None
    if not isinstance(results, dict) or "uniqueTournamentSeasons" not in results:
        raise SofaCliError(
            cmd, 0,
            f"unexpected response shape for get_player_seasons({player_id}): "
            f"expected results.uniqueTournamentSeasons, got top-level keys "
            f"{list(data.keys()) if isinstance(data, dict) else type(data).__name__}",
        )
    return results["uniqueTournamentSeasons"]


def get_player_season_stats(player_id: int, ut_id: int, season_id: int) -> dict:
    # Fallback: restituisce le classifiche aggregate dell'intero
    # torneo/stagione (results.topPlayers, un dict per statistica: goals,
    # assists, rating, ... ognuna con i top-50 giocatori). Il filtro per
    # player_id avviene in career.py (Task 5), che deve scandire le varie
    # categorie statistiche cercando l'id del giocatore.
    return run_cli(_cmd_player_season_stats(player_id, ut_id, season_id))
