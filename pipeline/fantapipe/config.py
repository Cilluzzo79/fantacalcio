from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]          # D:\railway\fantacalcio
PIPE_DATA = ROOT / "pipeline" / "data"              # gitignorato
CACHE_DIR = ROOT / "pipeline" / "cache"             # gitignorato
DATASET_OUT = ROOT / "data" / "dataset.json"        # pubblicato

SOFA_CLI = Path(r"C:\Users\Mauro\printing-press\library\sofascore\sofascore-pp-cli.exe")

RUOLI = ("P", "D", "C", "A")
ROSA_DEFAULT = {"P": 3, "D": 8, "C": 8, "A": 6}

SERIE_A_TOURNAMENT_ID = 23  # id SofaScore della Serie A (verificato nel Task 2)

LEAGUE_COEFF = {
    "Serie A": 1.00, "Premier League": 1.10, "LaLiga": 1.00, "La Liga": 1.00,
    "Bundesliga": 0.95, "Ligue 1": 0.90, "Eredivisie": 0.75,
    "Liga Portugal Betclic": 0.75, "Primeira Liga": 0.75, "Championship": 0.70,
    "Serie B": 0.65, "Trendyol Süper Lig": 0.70, "Belgian Pro League": 0.72,
    "UEFA Champions League": 1.10, "UEFA Europa League": 0.95,
    "Serie C": 0.50, "Allsvenskan": 0.60, "Swiss Super League": 0.70,
}

# Audit 2026-08-15: i tornei con girone nel nome ("Serie C, Girone C",
# "Campionato Nazionale Serie D...") non matchavano la tabella e cadevano
# sul default — che a 0.70 valutava la Serie D come il Championship
# (Colley del Frosinone da 42 crediti). Match per prefisso + default
# abbassato a livello "lega minore sconosciuta".
LEAGUE_COEFF_PREFIX = (("Serie C", 0.50), ("Serie D", 0.35),
                       ("Campionato Nazionale", 0.35))
LEAGUE_COEFF_DEFAULT = 0.55


def league_coeff(torneo: str) -> float:
    if torneo in LEAGUE_COEFF:
        return LEAGUE_COEFF[torneo]
    for prefix, coeff in LEAGUE_COEFF_PREFIX:
        if torneo.startswith(prefix):
            return coeff
    return LEAGUE_COEFF_DEFAULT


RECENCY_WEIGHTS = (0.5, 0.3, 0.2)  # stagione più recente per prima

# Mapping rating SofaScore -> voto medio italiano.
# Il rating medio di lega (~6.95) corrisponde al 6 politico; pendenza smorzata.
RATING_MEAN, VOTO_MEAN, RATING_SLOPE = 6.95, 6.0, 0.8
VOTO_MIN, VOTO_MAX = 5.25, 7.5


def rating_to_voto(rating: float) -> float:
    voto = VOTO_MEAN + (rating - RATING_MEAN) * RATING_SLOPE
    return max(VOTO_MIN, min(VOTO_MAX, voto))


BONUS = {"gol": 3.0, "assist": 1.0, "amm": -0.5, "esp": -1.0,
         "rig_parato": 3.0, "gol_subito": -1.0, "clean_sheet": 1.0}

# nomi squadra listone -> nomi squadra SofaScore
TEAM_ALIASES = {
    "Inter": "Inter", "Milan": "AC Milan", "Juventus": "Juventus",
    "Napoli": "Napoli", "Roma": "AS Roma", "Lazio": "Lazio",
    "Atalanta": "Atalanta", "Fiorentina": "Fiorentina", "Bologna": "Bologna",
    "Torino": "Torino", "Udinese": "Udinese", "Genoa": "Genoa",
    "Cagliari": "Cagliari", "Verona": "Hellas Verona", "Como": "Como",
    "Lecce": "Lecce", "Parma": "Parma", "Empoli": "Empoli",
    "Venezia": "Venezia", "Monza": "Monza", "Pisa": "Pisa",
    "Cremonese": "Cremonese", "Sassuolo": "Sassuolo",
    "Frosinone": "Frosinone",
}
