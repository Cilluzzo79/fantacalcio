import json
from fantapipe import career


RAW_SEASONS = [
    {"uniqueTournament": {"id": 23, "name": "Serie A"},
     "seasons": [{"id": 700, "year": "25/26"}, {"id": 600, "year": "24/25"}]},
    {"uniqueTournament": {"id": 17, "name": "Premier League"},
     "seasons": [{"id": 650, "year": "24/25"}]},
]

# Chiavi reali scoperte live sull'endpoint
# `player statistics get-player-season-statistics` (Barella 363856, ut 23,
# season 76457): results.statistics contiene ~115 chiavi, incluse quelle
# usate qui. get_player_season_stats() restituisce gia' il dict
# "statistics" scompattato (nessun envelope da rimuovere in career.py).
RAW_STATS = {
    "appearances": 30, "minutesPlayed": 2500, "goals": 5, "assists": 7,
    "yellowCards": 4, "redCards": 0, "rating": 7.1,
    "penaltiesTaken": 2, "penaltyGoals": 2,
    "goalsConceded": None, "cleanSheet": None,
    "penaltySave": None, "penaltyFaced": None,
}


class FakeClient:
    def __init__(self):
        self.stats_calls = []
    def get_player_seasons(self, pid):
        return RAW_SEASONS
    def get_player_season_stats(self, pid, ut_id, season_id):
        self.stats_calls.append((ut_id, season_id))
        return RAW_STATS


def test_fetch_career_normalizza(tmp_path):
    seasons = career.fetch_career(1, client=FakeClient(), cache_dir=tmp_path)
    assert len(seasons) == 3
    first = seasons[0]
    assert first.torneo == "Serie A" and first.season == "25/26"
    assert first.gol == 5 and first.assist == 7 and first.min == 2500
    assert first.coeff == 1.0
    premier = [s for s in seasons if s.torneo == "Premier League"][0]
    assert premier.coeff > 1.0


def test_fetch_career_usa_cache(tmp_path):
    c1 = FakeClient()
    career.fetch_career(1, client=c1, cache_dir=tmp_path)
    n_calls = len(c1.stats_calls)
    c2 = FakeClient()
    career.fetch_career(1, client=c2, cache_dir=tmp_path)
    assert len(c2.stats_calls) == 0 and n_calls > 0  # seconda volta: solo cache
    assert (tmp_path / "player_1.json").exists()


def test_max_4_stagioni(tmp_path):
    many = [{"uniqueTournament": {"id": 23, "name": "Serie A"},
             "seasons": [{"id": 700 + i, "year": f"{20+i}/{21+i}"} for i in range(6)]}]
    class C(FakeClient):
        def get_player_seasons(self, pid):
            return many
    seasons = career.fetch_career(2, client=C(), cache_dir=tmp_path)
    assert len(seasons) == 4


def test_career_to_jsonable_camelcase(tmp_path):
    seasons = career.fetch_career(1, client=FakeClient(), cache_dir=tmp_path)
    j = career.career_to_jsonable(seasons)
    assert "rigCalc" in j[0] and "golSubiti" in j[0] and "cleanSheet" in j[0]
