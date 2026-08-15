import json
from pathlib import Path
import pandas as pd
from fantapipe import config
from fantapipe.career import career_to_jsonable
from fantapipe.projections import project, project_from_qta
from fantapipe.traits import compute_traits, trait_notes
from fantapipe.valuation import assign_fasce, affidabilita

FASCE_VALIDE = {"top", "semitop", "titolare", "scommessa", "lowcost"}
REQUIRED_KEYS = ("id", "sofaId", "nome", "ruolo", "squadra", "qta", "fvm",
                 "fascia", "valueScore", "fmProj", "votoProj", "startsShare",
                 "affidabilita", "traits", "note", "seasons")


def build_dataset(matched_df: pd.DataFrame, careers: dict, season_label: str,
                  quotazioni_file: str, now_iso: str,
                  coaches: list[dict] | None = None) -> dict:
    rows = []
    for r in matched_df.itertuples():
        sofa_id = None if pd.isna(r.sofa_id) else int(r.sofa_id)
        seasons = careers.get(sofa_id, []) if sofa_id else []
        try:
            proj = project(seasons, r.ruolo, qta=int(r.qta))
        except ValueError:
            proj = project_from_qta(r.qta, r.ruolo)
            seasons = []
        traits = compute_traits(seasons, r.ruolo)
        aff = affidabilita(seasons, matched=sofa_id is not None,
                          dubbio=(r.match_status == "dubbio"))
        note = trait_notes(traits)
        if proj.starts_share >= 0.8:
            note.insert(0, f"Titolarità altissima ({proj.starts_share:.0%})")
        rows.append({
            "id": int(r.id), "sofaId": sofa_id, "nome": r.nome, "ruolo": r.ruolo,
            "squadra": r.squadra, "qta": int(r.qta), "fvm": int(r.fvm),
            "fascia": None,  # assegnata sotto, serve la distribuzione completa
            "valueScore": proj.value_score, "fmProj": proj.fm_proj,
            "votoProj": proj.voto_proj, "startsShare": proj.starts_share,
            "affidabilita": aff, "traits": traits, "note": note,
            "seasons": career_to_jsonable(seasons),
        })
    df = pd.DataFrame({"ruolo": [p["ruolo"] for p in rows],
                       "value_score": [p["valueScore"] for p in rows]})
    for player, fascia in zip(rows, assign_fasce(df)):
        player["fascia"] = fascia
    ds = {"schemaVersion": 1, "generatedAt": now_iso, "season": season_label,
          "quotazioniFile": quotazioni_file, "players": rows}
    # Chiave opzionale additiva (schemaVersion resta 1): presente solo con
    # listoni che includono gli allenatori (Gazzetta). L'app la ignora se
    # la lega non li usa.
    if coaches:
        ds["allenatori"] = coaches
    return ds


def validate_dataset(ds: dict) -> list[str]:
    problems = []
    if ds.get("schemaVersion") != 1:
        problems.append("schemaVersion != 1")
    players = ds.get("players", [])
    if not players:
        problems.append("players vuoto")
    ids = [p.get("id") for p in players]
    if len(ids) != len(set(ids)):
        problems.append("id listone duplicati")
    ruoli_presenti = set()
    for p in players:
        missing = [k for k in REQUIRED_KEYS if k not in p]
        if missing:
            problems.append(f"{p.get('nome', '?')}: chiavi mancanti {missing}")
            continue
        ruoli_presenti.add(p["ruolo"])
        if p["ruolo"] not in config.RUOLI:
            problems.append(f"{p['nome']}: ruolo non valido {p['ruolo']}")
        if p["valueScore"] < 0:
            problems.append(f"{p['nome']}: valueScore negativo")
        if not (5 <= p["affidabilita"] <= 100):
            problems.append(f"{p['nome']}: affidabilita fuori range")
        if p["fascia"] not in FASCE_VALIDE:
            problems.append(f"{p['nome']}: fascia non valida {p['fascia']}")
    for ruolo in config.RUOLI:
        if players and ruolo not in ruoli_presenti:
            problems.append(f"nessun giocatore con ruolo {ruolo}")
    if "allenatori" in ds:
        seen = set()
        for c in ds["allenatori"] or [{}]:
            if not (isinstance(c.get("nome"), str) and c["nome"]
                    and isinstance(c.get("squadra"), str) and c["squadra"]
                    and isinstance(c.get("qta"), int) and c["qta"] >= 1):
                problems.append(f"allenatore malformato: {c}")
                continue
            key = (c["nome"], c["squadra"])
            if key in seen:
                problems.append(f"allenatore duplicato: {key}")
            seen.add(key)
    return problems


def write_dataset(ds: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(ds, ensure_ascii=False, separators=(",", ":")),
                    encoding="utf-8")
