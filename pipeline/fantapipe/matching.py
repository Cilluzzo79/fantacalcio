import csv
import unicodedata
from pathlib import Path
import pandas as pd
from rapidfuzz import fuzz
from fantapipe import config, sofa_client

AUTO_THRESHOLD = 88      # >= match automatico
DUBBIO_THRESHOLD = 70    # tra i due -> "dubbio" (matcha comunque il migliore)


def normalize_name(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return " ".join(s.lower().replace(".", " ").replace("'", " ").split())


def build_sofa_index(squadre, client=sofa_client):
    index, warnings = {}, []
    for sq in squadre:
        alias = config.TEAM_ALIASES.get(sq)
        team_id = client.search_team(alias) if alias else None
        if team_id is None:
            index[sq] = []
            warnings.append(f"Squadra non risolta su SofaScore: {sq} (alias: {alias})")
            continue
        squad = client.get_team_squad(team_id)
        index[sq] = [{"sofaId": p["player"]["id"], "nome": p["player"]["name"]}
                     for p in squad if "player" in p]
    return index, warnings


def _best_match(nome_listone: str, candidates: list[dict]):
    target = normalize_name(nome_listone)
    best, best_score = None, 0.0
    for c in candidates:
        cand = normalize_name(c["nome"])
        # il listone usa "COGNOME I." -> confronta anche col solo cognome
        score = max(fuzz.token_set_ratio(target, cand),
                    fuzz.partial_ratio(target, cand))
        if score > best_score:
            best, best_score = c, score
    return best, best_score


def match_players(listone: pd.DataFrame, index: dict, overrides: dict) -> pd.DataFrame:
    df = listone.copy()
    ids, scores, statuses = [], [], []
    for row in df.itertuples():
        if row.id in overrides:
            ids.append(overrides[row.id]); scores.append(100.0); statuses.append("override")
            continue
        best, score = _best_match(row.nome, index.get(row.squadra, []))
        if best is None or score < DUBBIO_THRESHOLD:
            ids.append(pd.NA); scores.append(score); statuses.append("nessuno")
        elif score >= AUTO_THRESHOLD:
            status = "exact" if score >= 99.5 else "fuzzy"
            ids.append(best["sofaId"]); scores.append(score); statuses.append(status)
        else:
            ids.append(best["sofaId"]); scores.append(score); statuses.append("dubbio")
    df["sofa_id"] = pd.array(ids, dtype="Int64")
    df["match_score"] = scores
    df["match_status"] = statuses
    return df


def load_overrides(path: Path) -> dict:
    if not path.exists():
        return {}
    with open(path, newline="", encoding="utf-8") as f:
        return {int(r["listone_id"]): int(r["sofa_id"]) for r in csv.DictReader(f)}


def write_report(df: pd.DataFrame, path: Path) -> None:
    rep = df[df.match_status.isin(["dubbio", "nessuno"])]
    path.parent.mkdir(parents=True, exist_ok=True)
    rep[["id", "nome", "squadra", "ruolo", "sofa_id", "match_score", "match_status"]] \
        .to_csv(path, index=False, encoding="utf-8")
