import json
from fantapipe import career


# Anni distinti per ogni torneo, cosi' il fixture resta significativo anche
# con la selezione "un anno = una voce" (fix post-review 2026-08-13): Serie A
# 25/26 e 24/25, Premier League 23/24 (nessuna collisione di anno fra i due
# campionati).
RAW_SEASONS = [
    {"uniqueTournament": {"id": 23, "name": "Serie A"},
     "seasons": [{"id": 700, "year": "25/26"}, {"id": 600, "year": "24/25"}]},
    {"uniqueTournament": {"id": 17, "name": "Premier League"},
     "seasons": [{"id": 650, "year": "23/24"}]},
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
    # 6 anni distinti (Serie A ogni anno, nessuna sovrapposizione) -> le 4
    # piu' recenti vengono tenute, le altre 2 scartate.
    many = [{"uniqueTournament": {"id": 23, "name": "Serie A"},
             "seasons": [{"id": 700 + i, "year": f"{20+i}/{21+i}"} for i in range(6)]}]
    class C(FakeClient):
        def get_player_seasons(self, pid):
            return many
    seasons = career.fetch_career(2, client=C(), cache_dir=tmp_path)
    assert len(seasons) == 4
    assert [s.season for s in seasons] == ["25/26", "24/25", "23/24", "22/23"]


def test_career_to_jsonable_camelcase(tmp_path):
    seasons = career.fetch_career(1, client=FakeClient(), cache_dir=tmp_path)
    j = career.career_to_jsonable(seasons)
    assert "rigCalc" in j[0] and "golSubiti" in j[0] and "cleanSheet" in j[0]


def test_multi_competition_same_year_prefers_league(tmp_path):
    # Ogni anno ha 3 voci: campionato + coppa nazionale + qualificazioni
    # mondiali. Senza priorita' le 4 "piu' recenti" finivano tutte
    # accalcate in un solo anno (il bug segnalato in review su Barella).
    # Con la selezione "league-first" (round 2) restano solo le 2 voci di
    # Serie A: essendo >= 2 voci di campionato, nessun fallback scatta, e
    # le chiamate stats avvengono SOLO per quelle 2 voci.
    raw_seasons = [
        {"uniqueTournament": {"id": 23, "name": "Serie A"},
         "seasons": [{"id": 700, "year": "25/26"}, {"id": 600, "year": "24/25"}]},
        {"uniqueTournament": {"id": 99, "name": "Coppa Italia"},
         "seasons": [{"id": 701, "year": "25/26"}, {"id": 601, "year": "24/25"}]},
        {"uniqueTournament": {"id": 98, "name": "World Cup Qual. UEFA"},
         "seasons": [{"id": 702, "year": "25/26"}, {"id": 602, "year": "24/25"}]},
    ]
    class C(FakeClient):
        def get_player_seasons(self, pid):
            return raw_seasons
    client = C()
    seasons = career.fetch_career(3, client=client, cache_dir=tmp_path)
    assert len(seasons) == 2
    assert [s.torneo for s in seasons] == ["Serie A", "Serie A"]
    assert [s.season for s in seasons] == ["25/26", "24/25"]
    assert sorted(client.stats_calls) == sorted([(23, 700), (23, 600)])


def test_unknown_league_beats_cup(tmp_path):
    # "Brasileirao Serie A" non e' in config.LEAGUE_COEFF (priorita' 1,
    # campionato ignoto) ma batte comunque "Copa do Brasil" (priorita' 2,
    # coppa) nello stesso anno.
    raw_seasons = [
        {"uniqueTournament": {"id": 50, "name": "Brasileirao Serie A"},
         "seasons": [{"id": 800, "year": "25"}]},
        {"uniqueTournament": {"id": 51, "name": "Copa do Brasil"},
         "seasons": [{"id": 801, "year": "25"}]},
    ]
    class C(FakeClient):
        def get_player_seasons(self, pid):
            return raw_seasons
    seasons = career.fetch_career(4, client=C(), cache_dir=tmp_path)
    assert len(seasons) == 1
    assert seasons[0].torneo == "Brasileirao Serie A"


def test_fallback_to_cup_when_no_league_that_year(tmp_path):
    # Un'unica voce disponibile in assoluto, ed e' non-campionato: meglio
    # restituirla (fallback) che restituire un career vuoto.
    raw_seasons = [
        {"uniqueTournament": {"id": 98, "name": "World Cup Qual. UEFA"},
         "seasons": [{"id": 900, "year": "26"}]},
    ]
    class C(FakeClient):
        def get_player_seasons(self, pid):
            return raw_seasons
    seasons = career.fetch_career(5, client=C(), cache_dir=tmp_path)
    assert len(seasons) == 1
    assert seasons[0].torneo == "World Cup Qual. UEFA"


def test_barella_like_excludes_wc_qual_when_enough_league_seasons(tmp_path):
    # Round 2 fix: il bucket-anno piu' recente ("2026", qualificazioni
    # mondiali) non deve scalzare le stagioni di campionato quando ce ne
    # sono gia' >= MAX_SEASONS disponibili altrove. Selezione "league-first":
    # si prendono le voci di campionato fino a MAX_SEASONS, punto — le
    # qualificazioni mondiali non entrano mai in gioco qui.
    raw_seasons = [
        {"uniqueTournament": {"id": 23, "name": "Serie A"},
         "seasons": [{"id": 700, "year": "25/26"}, {"id": 600, "year": "24/25"},
                     {"id": 500, "year": "23/24"}]},
        {"uniqueTournament": {"id": 98, "name": "World Cup Qual. UEFA"},
         "seasons": [{"id": 900, "year": "2026"}]},
    ]
    class C(FakeClient):
        def get_player_seasons(self, pid):
            return raw_seasons
    seasons = career.fetch_career(6, client=C(), cache_dir=tmp_path)
    assert [s.torneo for s in seasons] == ["Serie A", "Serie A", "Serie A"]
    assert [s.season for s in seasons] == ["25/26", "24/25", "23/24"]


def test_january_transfer_same_year_both_kept(tmp_path):
    # Trasferimento di gennaio: due voci di campionato nello stesso anno
    # solare (Premier League + Serie A, entrambe 25/26) sono entrambe
    # segnale valido e NON vanno deduplicate per anno.
    raw_seasons = [
        {"uniqueTournament": {"id": 17, "name": "Premier League"},
         "seasons": [{"id": 750, "year": "25/26"}]},
        {"uniqueTournament": {"id": 23, "name": "Serie A"},
         "seasons": [{"id": 700, "year": "25/26"}, {"id": 600, "year": "24/25"}]},
    ]
    class C(FakeClient):
        def get_player_seasons(self, pid):
            return raw_seasons
    seasons = career.fetch_career(7, client=C(), cache_dir=tmp_path)
    assert len(seasons) == 3
    assert [(s.torneo, s.season) for s in seasons] == [
        ("Premier League", "25/26"), ("Serie A", "25/26"), ("Serie A", "24/25"),
    ]


def test_scarce_league_adds_one_fallback(tmp_path):
    # Solo 1 voce di campionato in assoluto: si completa con la miglior
    # voce non-campionato (piu' recente) fino ad arrivare a 2 voci totali.
    raw_seasons = [
        {"uniqueTournament": {"id": 23, "name": "Serie A"},
         "seasons": [{"id": 700, "year": "25/26"}]},
        {"uniqueTournament": {"id": 99, "name": "Coppa Italia"},
         "seasons": [{"id": 601, "year": "24/25"}]},
        {"uniqueTournament": {"id": 98, "name": "World Cup Qual. UEFA"},
         "seasons": [{"id": 500, "year": "23/24"}]},
    ]
    class C(FakeClient):
        def get_player_seasons(self, pid):
            return raw_seasons
    seasons = career.fetch_career(8, client=C(), cache_dir=tmp_path)
    assert len(seasons) == 2
    assert seasons[0].torneo == "Serie A" and seasons[0].season == "25/26"
    assert seasons[1].torneo == "Coppa Italia" and seasons[1].season == "24/25"


def test_pure_fallback_no_league_at_all(tmp_path):
    # Nessuna voce di campionato in assoluto: fallback su fino a 2 voci
    # non-campionato, anno piu' recente prima, al massimo una per anno.
    raw_seasons = [
        {"uniqueTournament": {"id": 99, "name": "Coppa Italia"},
         "seasons": [{"id": 601, "year": "24/25"}]},
        {"uniqueTournament": {"id": 98, "name": "World Cup Qual. UEFA"},
         "seasons": [{"id": 500, "year": "23/24"}]},
    ]
    class C(FakeClient):
        def get_player_seasons(self, pid):
            return raw_seasons
    seasons = career.fetch_career(9, client=C(), cache_dir=tmp_path)
    assert len(seasons) == 2
    assert [s.torneo for s in seasons] == ["Coppa Italia", "World Cup Qual. UEFA"]
    assert [s.season for s in seasons] == ["24/25", "23/24"]
