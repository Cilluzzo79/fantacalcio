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


# Fix post-review (2026-08-13): un anno spesso contiene piu' voci
# (campionato + coppe + nazionale). Senza priorita', 4 voci "piu' recenti"
# potevano finire tutte nello stesso anno (es. Serie A + Coppa Italia +
# Supercoppa + WC Qualifiers 25/26 per Barella), falsando sia la formula di
# durability del Task 6 (media minuti su una sola stagione spacciata per 4)
# sia la ponderazione per recency del Task 7 (fette dello stesso anno invece
# di anni distinti), oltre ad applicare league_coeff (pensato per pesare i
# campionati) a competizioni non-campionato.
EXCLUDE_KEYWORDS = ("cup", "copp", "copa", "super cup", "qual", "world cup",
                    "euro", "nations league", "friendl", "champions league",
                    "europa league", "conference league", "olymp", "africa cup")


def _priority(torneo: str) -> int:
    if torneo in config.LEAGUE_COEFF:
        return 0  # campionato noto
    if any(k in torneo.lower() for k in EXCLUDE_KEYWORDS):
        return 2  # coppa/nazionale/competizione non-campionato
    return 1      # campionato sconosciuto (es. lega estera minore) — batte le coppe


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

    # Un anno = una voce sola: fra le competizioni dello stesso anno vince
    # quella con priorita' piu' bassa (campionato noto > campionato ignoto >
    # coppa/nazionale). min() e' stabile: a parita' di priorita' vince la
    # prima incontrata nell'ordine restituito da get_player_seasons.
    by_year = {}
    for entry in entries:
        by_year.setdefault(entry[0], []).append(entry)

    selected = [
        min(by_year[year_key], key=lambda e: _priority(e[1]))
        for year_key in sorted(by_year, reverse=True)[:MAX_SEASONS]
    ]

    seasons = []
    for _, torneo, season_id, year, ut_id in selected:
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
