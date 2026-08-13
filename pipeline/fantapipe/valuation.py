import pandas as pd
from fantapipe.career import SeasonStats

FULL_SEASON_MIN = 3420
SOGLIE = [(0.97, "top"), (0.90, "semitop"), (0.70, "titolare"),
          (0.45, "scommessa"), (0.0, "lowcost")]


def assign_fasce(df: pd.DataFrame) -> pd.Series:
    out = pd.Series("lowcost", index=df.index, dtype=object)
    for ruolo, grp in df.groupby("ruolo"):
        pct = grp.value_score.rank(pct=True, method="average")
        for idx in grp.index:
            for soglia, nome in SOGLIE:
                if pct[idx] >= soglia:
                    out[idx] = nome
                    break
    return out


def affidabilita(seasons: list[SeasonStats], matched: bool) -> int:
    score = 100.0
    if not matched:
        score -= 60
    if seasons:
        if not any(s.torneo == "Serie A" for s in seasons):
            score -= 20
        if len(seasons) < 2:
            score -= 15
        share = min(1.0, seasons[0].min / FULL_SEASON_MIN)
        score -= 25 * max(0.0, 0.7 - share) / 0.7
    else:
        score -= 35  # nessuna carriera: discontinuità massima + stagioni < 2
    return int(max(5, min(100, round(score))))
