import csv
import unicodedata
from pathlib import Path
import pandas as pd
from rapidfuzz import fuzz
from fantapipe import config, sofa_client

AUTO_THRESHOLD = 88      # >= match automatico
DUBBIO_THRESHOLD = 70    # tra i due -> "dubbio" (matcha comunque il migliore)
AMBIGUITY_MARGIN = 5.0   # max score difference before downgrading to dubbio


def normalize_name(s: str) -> str:
    # U+2019 (apostrofo tipografico, es. "N'Dicka" da alcune fonti) non ha
    # decomposizione NFKD e verrebbe silenziosamente scartato dall'encode
    # ascii "ignore" sotto (a differenza dell'apostrofo ASCII, che diventa
    # spazio): normalizzarlo PRIMA cosi' segue lo stesso trattamento.
    s = s.replace("’", "'")
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
    second_score = 0.0
    for c in candidates:
        cand = normalize_name(c["nome"])
        # il listone usa "COGNOME I." -> confronta anche col solo cognome
        score = max(fuzz.token_set_ratio(target, cand),
                    fuzz.partial_ratio(target, cand))
        if score > best_score:
            second_score = best_score  # old best becomes second
            best, best_score = c, score
        elif score > second_score:
            second_score = score
    return best, best_score, second_score


def match_players(listone: pd.DataFrame, index: dict, overrides: dict) -> pd.DataFrame:
    df = listone.copy()
    ids, scores, statuses = [], [], []
    for row in df.itertuples():
        if row.id in overrides:
            ids.append(overrides[row.id]); scores.append(100.0); statuses.append("override")
            continue
        best, score, second_score = _best_match(row.nome, index.get(row.squadra, []))
        if best is None or score < DUBBIO_THRESHOLD:
            ids.append(pd.NA); scores.append(score); statuses.append("nessuno")
        elif score >= AUTO_THRESHOLD:
            # Check for ambiguity: if second-best score is too close, downgrade to dubbio
            if second_score >= score - AMBIGUITY_MARGIN:
                ids.append(best["sofaId"]); scores.append(score); statuses.append("dubbio")
            else:
                status = "exact" if score >= 99.5 else "fuzzy"
                ids.append(best["sofaId"]); scores.append(score); statuses.append(status)
        else:
            ids.append(best["sofaId"]); scores.append(score); statuses.append("dubbio")
    df["sofa_id"] = pd.array(ids, dtype="Int64")
    df["match_score"] = scores
    df["match_status"] = statuses

    # Fix post-review: due righe listone distinte non devono mai finire
    # matchate sullo stesso sofa_id (dati incoerenti a valle: carriera
    # duplicata su due giocatori). Le override sono forzature esplicite
    # dell'utente e restano escluse dal controllo. Tra le righe in
    # collisione si tiene quella col match_score piu' alto; le altre
    # vengono retrocesse a "duplicato" (sofa_id svuotato) cosi' finiscono
    # nel matching_report.csv per revisione manuale.
    not_override = df.match_status != "override"

    # Collisione MISTA override/non-override (deferred del Piano 1): se una
    # override forza un sofa_id che il fuzzy ha assegnato anche a un'altra
    # riga, vince la forzatura esplicita dell'utente e la riga fuzzy viene
    # retrocessa a "duplicato" (report per revisione manuale).
    override_ids = set(df.loc[~not_override, "sofa_id"].dropna())
    mixed = not_override & df.sofa_id.isin(override_ids)
    df.loc[mixed, "sofa_id"] = pd.NA
    df.loc[mixed, "match_status"] = "duplicato"

    dup_counts = df.loc[not_override & df.sofa_id.notna(), "sofa_id"].value_counts()
    for sofa_id in dup_counts[dup_counts > 1].index:
        rows = df[not_override & (df.sofa_id == sofa_id)]
        keep_idx = rows.match_score.idxmax()
        drop_idx = [i for i in rows.index if i != keep_idx]
        df.loc[drop_idx, "sofa_id"] = pd.NA
        df.loc[drop_idx, "match_status"] = "duplicato"

    return df


def load_overrides(path: Path) -> dict:
    if not path.exists():
        return {}
    with open(path, newline="", encoding="utf-8") as f:
        return {int(r["listone_id"]): int(r["sofa_id"]) for r in csv.DictReader(f)}


def write_report(df: pd.DataFrame, path: Path) -> None:
    rep = df[df.match_status.isin(["dubbio", "nessuno", "duplicato"])]
    path.parent.mkdir(parents=True, exist_ok=True)
    rep[["id", "nome", "squadra", "ruolo", "sofa_id", "match_score", "match_status"]] \
        .to_csv(path, index=False, encoding="utf-8")
