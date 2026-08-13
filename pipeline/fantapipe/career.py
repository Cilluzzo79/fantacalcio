import json
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from fantapipe import config, sofa_client

MAX_SEASONS = 4


@dataclass
class SeasonStats:
    season: str
    torneo: str
    coeff: float
    pg: int
    min: int
    gol: int
    assist: int
    amm: int
    esp: int
    rating: float | None
    rig_calc: int
    rig_segn: int
    gol_subiti: int | None
    clean_sheet: int | None
    rig_parati: int | None
    rig_subiti_affrontati: int | None


def _year_key(year: str) -> int:
    # "25/26" -> 25; "2025" -> 25
    head = year.split("/")[0]
    return int(head[-2:])


def _int(v):  return int(v) if v is not None else 0
def _opt(v):  return int(v) if v is not None else None


def _normalize(raw_stats: dict, torneo: str, season_year: str) -> SeasonStats:
    # sofa_client.get_player_season_stats() restituisce gia' il dict
    # "statistics" scompattato dall'envelope {"results": {"statistics": {...}}}
    # (vedi sofa_client.get_player_season_stats): niente da spacchettare qui.
    # Chiavi reali verificate live (Barella 363856, ut 23, season 76457) via
    # `player statistics get-player-season-statistics`.
    s = raw_stats
    return SeasonStats(
        season=season_year, torneo=torneo, coeff=config.league_coeff(torneo),
        pg=_int(s.get("appearances")), min=_int(s.get("minutesPlayed")),
        gol=_int(s.get("goals")), assist=_int(s.get("assists")),
        amm=_int(s.get("yellowCards")), esp=_int(s.get("redCards")),
        rating=s.get("rating"),
        rig_calc=_int(s.get("penaltiesTaken")), rig_segn=_int(s.get("penaltyGoals")),
        gol_subiti=_opt(s.get("goalsConceded")),
        clean_sheet=_opt(s.get("cleanSheet")),
        rig_parati=_opt(s.get("penaltySave")),
        rig_subiti_affrontati=_opt(s.get("penaltyFaced")),
    )


def fetch_career(sofa_id: int, client=sofa_client,
                 cache_dir: Path | None = None, max_age_days: int = 7):
    cache_dir = cache_dir or (config.CACHE_DIR / "players")
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_file = cache_dir / f"player_{sofa_id}.json"
    if cache_file.exists():
        age_days = (time.time() - cache_file.stat().st_mtime) / 86400
        if age_days <= max_age_days:
            data = json.loads(cache_file.read_text(encoding="utf-8"))
            return [SeasonStats(**d) for d in data]

    entries = []  # (year_key, torneo, season_id, year, ut_id)
    for t in client.get_player_seasons(sofa_id):
        torneo = t.get("uniqueTournament", {}).get("name", "?")
        for season in t.get("seasons", []):
            entries.append((_year_key(season["year"]), torneo,
                            season["id"], season["year"],
                            t.get("uniqueTournament", {}).get("id")))
    entries.sort(key=lambda e: e[0], reverse=True)

    seasons = []
    for _, torneo, season_id, year, ut_id in entries[:MAX_SEASONS]:
        raw = client.get_player_season_stats(sofa_id, ut_id, season_id)
        seasons.append(_normalize(raw, torneo, year))

    cache_file.write_text(json.dumps([asdict(s) for s in seasons]),
                          encoding="utf-8")
    return seasons


_JSON_KEYS = {"rig_calc": "rigCalc", "rig_segn": "rigSegn",
              "gol_subiti": "golSubiti", "clean_sheet": "cleanSheet",
              "rig_parati": "rigParati"}


def career_to_jsonable(seasons):
    out = []
    for s in seasons[:3]:  # nel dataset finiscono max 3 stagioni
        d = asdict(s)
        d.pop("rig_subiti_affrontati")
        for k_py, k_json in _JSON_KEYS.items():
            d[k_json] = d.pop(k_py)
        out.append(d)
    return out
