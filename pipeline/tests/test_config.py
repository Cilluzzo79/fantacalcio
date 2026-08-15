import pytest
from fantapipe import config


def test_costanti_base():
    assert config.RUOLI == ("P", "D", "C", "A")
    assert sum(config.ROSA_DEFAULT.values()) == 25
    assert config.SOFA_CLI.name == "sofascore-pp-cli.exe"


def test_league_coeff():
    assert config.league_coeff("Serie A") == 1.0
    assert config.league_coeff("Premier League") > 1.0
    # torneo sconosciuto -> default prudente
    assert config.league_coeff("K League 1") == config.LEAGUE_COEFF_DEFAULT
    assert 0 < config.LEAGUE_COEFF_DEFAULT < 1


def test_league_coeff_leghe_minori_e_gironi():
    # Audit 2026-08-15: "Serie C, Girone C" non matchava la tabella (nome
    # con girone) e cadeva sul default 0.70, troppo generoso — Colley
    # (Serie D) ed equivalenti valevano da titolari di Serie A. Match per
    # prefisso + default abbassato.
    assert config.league_coeff("Serie C, Girone C") == pytest.approx(0.50)
    assert config.league_coeff("Serie D, Girone A") == pytest.approx(0.35)
    assert config.league_coeff("Campionato Nazionale Serie D") == pytest.approx(0.35)
    assert config.league_coeff("Allsvenskan") == pytest.approx(0.60)
    assert config.LEAGUE_COEFF_DEFAULT == pytest.approx(0.55)
    # la Serie B esplicita resta invariata
    assert config.league_coeff("Serie B") == pytest.approx(0.65)


def test_rating_to_voto():
    # il rating medio SofaScore (~6.95) deve mappare sul 6 politico italiano
    assert abs(config.rating_to_voto(6.95) - 6.0) < 0.01
    assert config.rating_to_voto(8.5) <= 7.5   # clamp alto
    assert config.rating_to_voto(5.0) >= 5.25  # clamp basso
    assert config.rating_to_voto(7.4) > config.rating_to_voto(6.9)


def test_team_aliases_coprono_le_squadre_gazzetta():
    # ogni squadra del listone Gazzetta deve avere un alias SofaScore,
    # altrimenti tutti i suoi giocatori finiscono match_status="nessuno"
    from fantapipe.listone_gazzetta import KNOWN_TEAMS
    mancanti = set(KNOWN_TEAMS) - set(config.TEAM_ALIASES)
    assert not mancanti, f"squadre senza alias: {sorted(mancanti)}"


def test_recency_weights():
    assert abs(sum(config.RECENCY_WEIGHTS) - 1.0) < 1e-9
    assert config.RECENCY_WEIGHTS[0] > config.RECENCY_WEIGHTS[-1]
