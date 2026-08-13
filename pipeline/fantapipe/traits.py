from fantapipe.career import SeasonStats

FULL_SEASON_MIN = 3420  # 38 partite x 90'

NOTES = {
    "rigorista": "Rigorista designato",
    "punizioni": "Specialista calci piazzati",
    "assistman": "Assist-man storico",
    "pararigori": "Para-rigori sopra la media",
    "cartellino": "Rischio cartellini alto",
    "bonusdifesa": "Difensore/centrocampista da bonus",
    "durevole": "Sempre in campo, storicamente durevole",
    "fragile": "Storico di infortuni/minutaggio basso",
}


def _tot(seasons, attr):
    return sum(getattr(s, attr) or 0 for s in seasons)


def compute_traits(seasons: list[SeasonStats], ruolo: str) -> list[str]:
    if not seasons:
        return []
    traits = []
    pg_tot = max(1, _tot(seasons, "pg"))

    if _tot(seasons, "rig_calc") >= 5 or seasons[0].rig_calc >= 3:
        traits.append("rigorista")
    if pg_tot >= 30 and _tot(seasons, "assist") / pg_tot >= 0.15:
        traits.append("assistman")
    if ruolo == "P":
        aff = _tot(seasons, "rig_subiti_affrontati")
        if aff >= 8 and _tot(seasons, "rig_parati") / aff >= 0.25:
            traits.append("pararigori")
    if pg_tot >= 30 and (_tot(seasons, "amm") + 3 * _tot(seasons, "esp")) / pg_tot >= 0.28:
        traits.append("cartellino")
    if ruolo in ("D", "C") and pg_tot >= 30 \
            and (_tot(seasons, "gol") + _tot(seasons, "assist")) / pg_tot >= 0.15:
        traits.append("bonusdifesa")

    recent = seasons[:3]
    shares = [min(1.0, s.min / FULL_SEASON_MIN) for s in recent]
    avg_share = sum(shares) / len(shares)
    if avg_share >= 0.70:
        traits.append("durevole")
    elif avg_share <= 0.40 and pg_tot >= 20:
        traits.append("fragile")
    return traits


def trait_notes(traits: list[str]) -> list[str]:
    return [NOTES[t] for t in traits if t in NOTES]
