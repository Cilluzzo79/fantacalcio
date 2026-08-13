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

    # Fix round 2 post-review (2026-08-13): la versione "un anno = una voce
    # con fallback" del round 1 aveva ancora un difetto — ad agosto un
    # giocatore di nazionale non ha ancora una voce di campionato per la
    # nuova stagione (es. "26/27" non esiste finche' non parte il
    # campionato), quindi l'anno-bucket piu' recente (es. "2026" per le
    # qualificazioni mondiali) restava occupato SOLO dalla voce non-lega,
    # scalzando una stagione di campionato vera dalle 4 slot e finendo con
    # peso di recency massimo (Task 7) su una competizione non-campionato.
    # Selezione "league-first": si prendono fino a MAX_SEASONS voci di
    # campionato (priorita' <= 1), SENZA deduplicare per anno (un
    # trasferimento di gennaio da un campionato a un altro nello stesso
    # anno solare produce legittimamente due voci di campionato nello
    # stesso anno, entrambe con segnale utile). Solo se le voci di
    # campionato sono scarse (< 2) si aggiunge un fallback non-campionato
    # (al massimo una voce per anno, anno piu' recente prima) fino ad
    # arrivare a 2 voci totali o esaurire le opzioni.
    league_entries = sorted(
        (e for e in entries if _priority(e[1]) <= 1),
        key=lambda e: e[0], reverse=True,
    )[:MAX_SEASONS]

    selected = list(league_entries)
    if len(selected) < 2:
        covered_years = {e[0] for e in selected}
        seen_fallback_years = set()
        fallback_entries = sorted(
            (e for e in entries if _priority(e[1]) == 2),
            key=lambda e: e[0], reverse=True,
        )
        for e in fallback_entries:
            if len(selected) >= 2:
                break
            year_key = e[0]
            if year_key in covered_years or year_key in seen_fallback_years:
                continue
            seen_fallback_years.add(year_key)
            selected.append(e)
        selected.sort(key=lambda e: e[0], reverse=True)

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
