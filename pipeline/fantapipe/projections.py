from dataclasses import dataclass
from fantapipe import config
from fantapipe.career import SeasonStats

MIN_PG = 5
NEUTRAL_RATING = 6.6
FULL_SEASON_MIN = 3420

# Base fantamedia per il value_score, PER RUOLO. Il "6 politico" vale per i
# giocatori di movimento, ma un portiere in Classic vive strutturalmente
# sotto (il -1 a gol subito e' fisiologico, ~1.3 gol/pg): una base unica a
# 6.0 appiattiva a zero TUTTI i portieri reali, che finivano scavalcati dal
# fallback qta*0.8 dei terzi portieri (bug scoperto allo smoke test
# 2026-08-15: De Gea a prezzo 1). La base si cancella nel VORP per ruolo
# dell'app (repl e' calcolato dentro il ruolo): conta solo che non schiacci
# le differenze reali. Basi basse quanto serve a non clampare nessun
# titolare vero.
VALUE_BASE = {"P": 4.0, "D": 5.0, "C": 5.0, "A": 5.0}


@dataclass
class Projection:
    voto_proj: float
    fm_proj: float
    starts_share: float
    value_score: float


def _weights(n: int) -> list[float]:
    raw = config.RECENCY_WEIGHTS[:n]
    tot = sum(raw)
    return [w / tot for w in raw]


def project(seasons: list[SeasonStats], ruolo: str) -> Projection:
    usable = [s for s in seasons if s.pg >= MIN_PG]
    if ruolo == "P":
        # Un portiere con presenze ma senza gol_subiti e' un buco nei dati
        # (statistica non tracciata per quella stagione/torneo): usarla
        # come se avesse subito 0 gol falserebbe fm_bonus verso l'alto.
        # Meglio scartarla e cadere sul fallback per quotazione se non
        # resta nulla di utilizzabile.
        usable = [s for s in usable if not (s.pg > 0 and s.gol_subiti is None)]
    usable = usable[:3]
    if not usable:
        raise ValueError("carriera vuota o senza stagioni utilizzabili")
    w = _weights(len(usable))

    voto = fm_bonus = share = 0.0
    for wi, s in zip(w, usable):
        rating = s.rating if s.rating is not None else NEUTRAL_RATING
        rating_adj = config.RATING_MEAN + (rating - config.RATING_MEAN) * s.coeff
        voto += wi * config.rating_to_voto(rating_adj)
        pg = max(1, s.pg)
        if ruolo == "P":
            gs = (s.gol_subiti or 0) / pg
            cs = (s.clean_sheet or 0) / pg
            rp = (s.rig_parati or 0) / pg
            fm_bonus += wi * (config.BONUS["gol_subito"] * gs
                              + config.BONUS["clean_sheet"] * cs
                              + config.BONUS["rig_parato"] * rp)
        else:
            fm_bonus += wi * (config.BONUS["gol"] * (s.gol / pg) * s.coeff
                              + config.BONUS["assist"] * (s.assist / pg) * s.coeff
                              + config.BONUS["amm"] * (s.amm / pg)
                              + config.BONUS["esp"] * (s.esp / pg))
        share += wi * min(1.0, s.min / FULL_SEASON_MIN)

    fm = voto + fm_bonus
    value = round(max(0.0, fm - VALUE_BASE[ruolo]) * share * 38, 1)
    return Projection(round(voto, 2), round(fm, 2), round(share, 4), value)


def project_from_qta(qta: int, ruolo: str) -> Projection:
    return Projection(voto_proj=6.0, fm_proj=round(6.0 + qta / 40, 2),
                      starts_share=0.5, value_score=round(qta * 0.8, 1))
