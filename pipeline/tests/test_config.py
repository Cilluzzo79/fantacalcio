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


def test_rating_to_voto():
    # il rating medio SofaScore (~6.95) deve mappare sul 6 politico italiano
    assert abs(config.rating_to_voto(6.95) - 6.0) < 0.01
    assert config.rating_to_voto(8.5) <= 7.5   # clamp alto
    assert config.rating_to_voto(5.0) >= 5.25  # clamp basso
    assert config.rating_to_voto(7.4) > config.rating_to_voto(6.9)


def test_recency_weights():
    assert abs(sum(config.RECENCY_WEIGHTS) - 1.0) < 1e-9
    assert config.RECENCY_WEIGHTS[0] > config.RECENCY_WEIGHTS[-1]
