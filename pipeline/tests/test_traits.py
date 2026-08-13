from fantapipe.career import SeasonStats
from fantapipe.traits import compute_traits, trait_notes


def mk(gol=0, assist=0, amm=0, esp=0, pg=34, minuti=3000, rig_calc=0,
       rig_parati=None, rig_aff=None):
    return SeasonStats(season="25/26", torneo="Serie A", coeff=1.0, pg=pg,
                       min=minuti, gol=gol, assist=assist, amm=amm, esp=esp,
                       rating=7.0, rig_calc=rig_calc, rig_segn=rig_calc,
                       gol_subiti=None, clean_sheet=None,
                       rig_parati=rig_parati, rig_subiti_affrontati=rig_aff)


def test_rigorista():
    assert "rigorista" in compute_traits([mk(rig_calc=3), mk(rig_calc=2)], "A")
    assert "rigorista" not in compute_traits([mk(rig_calc=1), mk(rig_calc=1)], "A")


def test_assistman():
    assert "assistman" in compute_traits([mk(assist=8), mk(assist=6)], "C")
    assert "assistman" not in compute_traits([mk(assist=2), mk(assist=1)], "C")


def test_pararigori_solo_portieri():
    s = [mk(rig_parati=3, rig_aff=10)]
    assert "pararigori" in compute_traits(s, "P")
    assert "pararigori" not in compute_traits(s, "D")


def test_cartellino():
    assert "cartellino" in compute_traits([mk(amm=11), mk(amm=10)], "D")


def test_bonusdifesa_solo_d_e_c():
    s = [mk(gol=4, assist=3)]
    assert "bonusdifesa" in compute_traits(s, "D")
    assert "bonusdifesa" not in compute_traits(s, "A")


def test_durevole_e_fragile():
    assert "durevole" in compute_traits([mk(minuti=3100)] * 3, "C")
    assert "fragile" in compute_traits([mk(minuti=1000, pg=12)] * 3, "C")


def test_carriera_vuota():
    assert compute_traits([], "A") == []


def test_note_italiane():
    notes = trait_notes(["rigorista", "fragile"])
    assert len(notes) == 2 and any("rigor" in n.lower() for n in notes)
