from pathlib import Path
import pandas as pd
from fantapipe import config

# nomi colonna del file ufficiale -> nomi normalizzati (chiavi in lowercase)
# Ordine: id, nome, ruolo, squadra, qta, fvm
COLMAP = {"id": "id", "nome": "nome", "r": "ruolo", "squadra": "squadra",
          "qt.a": "qta", "fvm": "fvm"}


class ListoneError(Exception):
    pass


def _find_header_row(raw: pd.DataFrame) -> int | None:
    for i in range(min(5, len(raw))):
        cells = [str(c).strip().lower() for c in raw.iloc[i].tolist()]
        non_empty = [c for c in cells if c and c != 'nan']
        # First row with multiple non-empty cells is likely the header
        if len(non_empty) >= 3:
            return i
    return None


def load_listone(path: Path) -> pd.DataFrame:
    raw = pd.read_excel(path, header=None)
    hrow = _find_header_row(raw)
    if hrow is None:
        found = [str(c) for c in raw.iloc[0].tolist()]
        raise ListoneError(f"Header non trovato nelle prime 5 righe. Prima riga: {found}")
    df = pd.read_excel(path, header=hrow)
    # Keep original column names for error messages
    original_columns = [str(c).strip() for c in df.columns]
    df.columns = [str(c).strip().lower() for c in df.columns]
    missing = [c for c in COLMAP if c not in df.columns]
    if missing:
        raise ListoneError(
            f"Colonne mancanti {missing}. Colonne trovate: {original_columns}")
    df = df[list(COLMAP)].rename(columns=COLMAP)
    df = df[df.ruolo.isin(config.RUOLI)].copy()
    df["id"] = df.id.astype(int)
    df["qta"] = pd.to_numeric(df.qta, errors="coerce").fillna(1).astype(int)
    df["fvm"] = pd.to_numeric(df.fvm, errors="coerce").fillna(1).astype(int)
    df["nome"] = df.nome.astype(str).str.strip()
    df["squadra"] = df.squadra.astype(str).str.strip()
    return df.reset_index(drop=True)
