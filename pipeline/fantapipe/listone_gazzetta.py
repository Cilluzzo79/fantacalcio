"""Parser del listone PDF Gazzetta (fantacampionato.gazzetta.it).

Layout: pagine A4 a due colonne, sezioni per ruolo (Portieri/Difensori/
Centrocampisti/Attaccanti/Allenatori), voci "NOME Squadra Costo".
L'ordine di lettura corretto è colonna sinistra completa, poi destra:
ogni header di sezione precede fisicamente le sue voci in quel flusso.

Il PDF non ha id numerici né FVM: gli id vengono sintetizzati con un hash
stabile di (ruolo, nome, squadra) — restano identici tra run settimanali
finché il giocatore non cambia squadra — e qta=fvm=costo in fantamilioni.
"""
import zlib
from pathlib import Path

import pandas as pd


class GazzettaError(Exception):
    pass


SECTION_TO_RUOLO = {"Portieri": "P", "Difensori": "D",
                    "Centrocampisti": "C", "Attaccanti": "A",
                    "Allenatori": "ALL"}

# nomi squadra come compaiono nel PDF -> forma canonica breve
TEAM_CANON = {"Internazionale": "Inter"}

KNOWN_TEAMS = ("Atalanta", "Bologna", "Cagliari", "Como", "Fiorentina",
               "Frosinone", "Genoa", "Inter", "Juventus", "Lazio", "Lecce",
               "Milan", "Monza", "Napoli", "Parma", "Roma", "Sassuolo",
               "Torino", "Udinese", "Venezia")


def _is_noise(line: str) -> bool:
    return (not line or line.startswith("IL LISTONE")
            or line.startswith("Nome Squadra") or "gazzetta.it" in line)


def _split_entry(line: str) -> tuple[str, str, int]:
    tokens = line.split()
    try:
        costo = int(tokens[-1])
    except (ValueError, IndexError):
        raise GazzettaError(f"Riga non riconosciuta: {line!r}")
    # squadra = 1 o 2 token prima del costo (es. futuro "Hellas Verona")
    for n in (1, 2):
        squadra_raw = " ".join(tokens[-1 - n:-1])
        squadra = TEAM_CANON.get(squadra_raw, squadra_raw)
        nome = " ".join(tokens[:-1 - n])
        if squadra in KNOWN_TEAMS and nome:
            return nome, squadra, costo
    raise GazzettaError(f"Squadra sconosciuta in riga: {line!r}")


def parse_entries(lines: list[str]) -> tuple[list[dict], list[dict]]:
    """Righe in ordine di lettura -> (giocatori, allenatori)."""
    players, coaches = [], []
    ruolo = None
    for raw in lines:
        line = raw.strip()
        if _is_noise(line):
            continue
        if line in SECTION_TO_RUOLO:
            ruolo = SECTION_TO_RUOLO[line]
            continue
        if ruolo is None:
            raise GazzettaError(f"Voce fuori sezione: {line!r}")
        nome, squadra, costo = _split_entry(line)
        rec = {"nome": nome, "squadra": squadra, "costo": costo}
        if ruolo == "ALL":
            coaches.append(rec)
        else:
            players.append({**rec, "ruolo": ruolo})
    return players, coaches


def stable_id(ruolo: str, nome: str, squadra: str) -> int:
    key = f"{ruolo}|{nome}|{squadra}".encode("utf-8")
    return (zlib.crc32(key) & 0x7FFFFFFF) or 1


def to_listone_df(players: list[dict]) -> pd.DataFrame:
    # Voci identiche (ruolo, nome, squadra) esistono davvero (i gemelli
    # Oyono al Frosinone): la seconda occorrenza viene disambiguata con
    # " (2)" — in ordine di apparizione nel PDF — così id e matching
    # restano distinti e il matching_report la segnala per l'override.
    # Più di 2 occorrenze indicano quasi certamente un bug di parsing.
    counts: dict[tuple, int] = {}
    rows = []
    for p in players:
        key = (p["ruolo"], p["nome"], p["squadra"])
        n = counts[key] = counts.get(key, 0) + 1
        if n > 2:
            raise GazzettaError(f"Voce duplicata {n} volte: {key}")
        nome = p["nome"] if n == 1 else f"{p['nome']} ({n})"
        rows.append({"id": stable_id(p["ruolo"], nome, p["squadra"]),
                     "nome": nome, "ruolo": p["ruolo"],
                     "squadra": p["squadra"],
                     "qta": p["costo"], "fvm": p["costo"]})
    df = pd.DataFrame(rows, columns=["id", "nome", "ruolo", "squadra",
                                     "qta", "fvm"])
    if not df.id.is_unique:
        dupes = df[df.id.duplicated(keep=False)].nome.tolist()
        raise GazzettaError(f"Collisione di id sintetici: {dupes}")
    for col in ("id", "qta", "fvm"):
        df[col] = df[col].astype("int64")
    return df


def extract_lines(path: Path) -> list[str]:
    """Ricostruisce le righe di testo in ordine di lettura (col. sx poi dx)."""
    import pdfplumber
    lines = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            words = page.extract_words()
            mid = page.width / 2
            for in_column in (lambda w: w["x0"] < mid,
                              lambda w: w["x0"] >= mid):
                col = sorted(filter(in_column, words),
                             key=lambda w: (w["top"], w["x0"]))
                # cluster per gap verticale: l'interlinea (~14-20pt) è ben
                # maggiore della varianza di baseline intra-riga (<5pt)
                rows: list[list] = []
                for w in col:
                    if rows and w["top"] - rows[-1][0]["top"] <= 5:
                        rows[-1].append(w)
                    else:
                        rows.append([w])
                for row in rows:
                    ws = sorted(row, key=lambda w: w["x0"])
                    lines.append(" ".join(w["text"] for w in ws))
    return lines


def load_listone_gazzetta(path: Path) -> tuple[pd.DataFrame, list[dict]]:
    """PDF Gazzetta -> (DataFrame contratto listone, allenatori).

    Gli allenatori sono record {nome, squadra, qta} separati dai giocatori:
    non hanno statistiche SofaScore e nel dataset finiscono nella chiave
    opzionale top-level "allenatori".
    """
    players, coaches = parse_entries(extract_lines(path))
    if not players:
        raise GazzettaError(f"Nessun giocatore estratto da {path.name}")
    df = to_listone_df(players)
    coaches_out = [{"nome": c["nome"], "squadra": c["squadra"],
                    "qta": c["costo"]} for c in coaches]
    return df, coaches_out
