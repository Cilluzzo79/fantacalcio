# Pipeline Dati Fantacalcio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pipeline Python che unisce statistiche SofaScore (via `sofascore-pp-cli`) e quotazioni del listone Fantacalcio.it, calcola le valutazioni dei giocatori e pubblica `data/dataset.json` su GitHub (servito via raw.githubusercontent.com) per l'app mobile.

**Architecture:** Package Python `fantapipe` in `pipeline/`, con il CLI SofaScore isolato dietro un unico modulo wrapper (`sofa_client.py`). Flusso: listone Excel → matching con le rose SofaScore → fetch carriere multi-campionato (con cache) → profilo caratteristiche → proiezioni → valutazione → `dataset.json` → commit/push su GitHub. Orchestrazione da `python -m fantapipe.cli`, schedulata con Task Scheduler.

**Tech Stack:** Python 3.13, pandas + openpyxl (Excel), rapidfuzz (matching), requests + python-dotenv (download listone), pytest. Git/GitHub (`gh` CLI già autenticabile). `sofascore-pp-cli.exe` in `C:\Users\Mauro\printing-press\library\sofascore\`.

**Spec di riferimento:** `docs/superpowers/specs/2026-08-12-fantacalcio-asta-design.md`

## Global Constraints

- Piattaforma: Windows 11, shell PowerShell. Tutti i path assoluti usano `D:\railway\fantacalcio`.
- Python: 3.13 (`python` nel PATH). Ambiente virtuale in `pipeline/.venv`.
- Il CLI SofaScore va invocato SEMPRE con `--agent` (JSON, non-interattivo) e MAI con rate-limit disabilitato (default 2 req/s).
- Il dataset NON contiene prezzi in crediti: contiene `valueScore` (fantapunti attesi sopra il 6, per stagione); replacement/VORP/prezzi li calcola l'app per lega.
- Ruoli Classic: `P`, `D`, `C`, `A`. Rosa default 3P/8D/8C/6A.
- Repo git già inizializzato in `D:\railway\fantacalcio` (branch `master`). Il repo sarà pubblicato su GitHub come repo **pubblico** (il dataset deve essere leggibile via raw senza token). Niente segreti nel repo: `.env` e `cache/` sono gitignorati.
- Ogni file di dati generato vive in `pipeline/data/` (gitignorato) TRANNE `data/dataset.json` alla radice del repo, che è l'unico artefatto pubblicato.
- Commit frequenti: ogni task termina con un commit. Messaggi in inglese, prefissi `feat:`/`test:`/`chore:`/`docs:`.
- Tutti i test si lanciano da `pipeline/` con `..\.venv... ` no: con `.venv\Scripts\python -m pytest tests -v` (venv dentro `pipeline/`).

## Contratto `dataset.json` (usato dai Task 9-10 e dal futuro piano app)

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-08-12T07:00:00+00:00",
  "season": "2026-27",
  "quotazioniFile": "quotazioni_2026-08-10.xlsx",
  "players": [
    {
      "id": 2170,
      "sofaId": 827606,
      "nome": "Barella",
      "ruolo": "C",
      "squadra": "Inter",
      "qta": 28,
      "fvm": 120,
      "fascia": "top",
      "valueScore": 41.3,
      "fmProj": 7.08,
      "votoProj": 6.42,
      "startsShare": 0.86,
      "affidabilita": 82,
      "traits": ["assistman"],
      "note": ["Titolarità altissima (86%)", "Assist-man storico"],
      "seasons": [
        {"season": "2025-26", "torneo": "Serie A", "coeff": 1.0, "pg": 34,
         "min": 2980, "gol": 4, "assist": 8, "amm": 6, "esp": 0, "rating": 7.21,
         "rigCalc": 0, "rigSegn": 0, "golSubiti": null, "cleanSheet": null,
         "rigParati": null}
      ]
    }
  ]
}
```

- `fascia` ∈ `top|semitop|titolare|scommessa|lowcost`; `affidabilita` ∈ 5..100 (int);
  `valueScore` ≥ 0 (float, 1 decimale); `traits` ⊆ `rigorista|punizioni|assistman|pararigori|cartellino|bonusdifesa|fragile|durevole`.
- `sofaId` è `null` per giocatori non matchati (→ `affidabilita` ≤ 40, `seasons: []`).
- Campi portiere (`golSubiti`, `cleanSheet`, `rigParati`) sono `null` per i non-portieri.
- `seasons` contiene al massimo le ultime 3 stagioni, la più recente per prima.

---

### Task 1: Scaffold del progetto pipeline

**Files:**
- Create: `pipeline/pyproject.toml`
- Create: `pipeline/fantapipe/__init__.py`
- Create: `pipeline/fantapipe/config.py`
- Create: `pipeline/tests/test_config.py`
- Create: `.gitignore` (radice repo)
- Create: `pipeline/README.md`

**Interfaces:**
- Produces: modulo `fantapipe.config` con le costanti usate da TUTTI i task successivi:
  `SOFA_CLI: Path`, `ROOT: Path`, `PIPE_DATA: Path`, `CACHE_DIR: Path`, `RUOLI: tuple`,
  `ROSA_DEFAULT: dict`, `LEAGUE_COEFF: dict[str, float]`, `LEAGUE_COEFF_DEFAULT: float`,
  `league_coeff(torneo: str) -> float`, `RECENCY_WEIGHTS: tuple[float, ...]`,
  `rating_to_voto(rating: float) -> float`, `TEAM_ALIASES: dict[str, str]`,
  `BONUS = {"gol": 3.0, "assist": 1.0, "amm": -0.5, "esp": -1.0, "rig_parato": 3.0, "gol_subito": -1.0, "clean_sheet": 1.0}`

- [ ] **Step 1: Crea venv e struttura**

```powershell
Set-Location D:\railway\fantacalcio
python -m venv pipeline\.venv
pipeline\.venv\Scripts\python -m pip install --upgrade pip
New-Item -ItemType Directory -Force pipeline\fantapipe, pipeline\tests, pipeline\data, pipeline\cache
```

- [ ] **Step 2: Scrivi `.gitignore` (radice), `pipeline/pyproject.toml`, `pipeline/README.md`**

`.gitignore`:
```gitignore
pipeline/.venv/
pipeline/cache/
pipeline/data/
.env
__pycache__/
*.pyc
.pytest_cache/
node_modules/
```

`pipeline/pyproject.toml`:
```toml
[project]
name = "fantapipe"
version = "0.1.0"
requires-python = ">=3.13"
dependencies = [
  "pandas>=2.2",
  "openpyxl>=3.1",
  "rapidfuzz>=3.9",
  "requests>=2.32",
  "python-dotenv>=1.0",
]

[project.optional-dependencies]
dev = ["pytest>=8.0", "responses>=0.25"]

[tool.pytest.ini_options]
testpaths = ["tests"]
```

`pipeline/README.md`: tre righe — cosa fa la pipeline, come lanciarla (`.venv\Scripts\python -m fantapipe.cli --listone <file.xlsx>`), come lanciare i test.

- [ ] **Step 3: Installa le dipendenze**

```powershell
Set-Location D:\railway\fantacalcio\pipeline
.venv\Scripts\python -m pip install -e ".[dev]"
```

- [ ] **Step 4: Scrivi il test di config (fallirà: modulo inesistente)**

`pipeline/tests/test_config.py`:
```python
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
```

- [ ] **Step 5: Esegui il test — deve FALLIRE**

Run: `.venv\Scripts\python -m pytest tests\test_config.py -v`
Expected: FAIL / errore import `fantapipe.config`

- [ ] **Step 6: Implementa `fantapipe/config.py` (e `__init__.py` vuoto)**

```python
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
}
LEAGUE_COEFF_DEFAULT = 0.70


def league_coeff(torneo: str) -> float:
    return LEAGUE_COEFF.get(torneo, LEAGUE_COEFF_DEFAULT)


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
}
```

Nota per l'esecutore: le squadre 2026-27 effettive escono dal listone reale; se una
squadra del listone manca in `TEAM_ALIASES`, il matching (Task 4) la segnala nel
report — aggiungila qui.

- [ ] **Step 7: Esegui i test — devono PASSARE**

Run: `.venv\Scripts\python -m pytest tests\test_config.py -v`
Expected: PASS (4 test)

- [ ] **Step 8: Commit**

```powershell
Set-Location D:\railway\fantacalcio
git add .gitignore pipeline
git commit -m "feat: scaffold fantapipe package with config and league coefficients"
```

---

### Task 2: Wrapper del CLI SofaScore (`sofa_client`)

**Files:**
- Create: `pipeline/fantapipe/sofa_client.py`
- Test: `pipeline/tests/test_sofa_client.py`

**Interfaces:**
- Consumes: `config.SOFA_CLI`
- Produces (usate dai Task 4-5):
  - `run_cli(args: list[str]) -> dict | list` — esegue il CLI con `--agent`, parse JSON, solleva `SofaCliError(cmd, returncode, stderr)` su exit ≠ 0
  - `get_team_squad(team_id: int) -> list[dict]` — rosa squadra (ogni dict ha almeno `player.id`, `player.name`, `player.position`)
  - `search_team(name: str) -> int | None` — id squadra dal nome
  - `get_player(player_id: int) -> dict`
  - `get_player_seasons(player_id: int) -> list[dict]` — stagioni con statistiche disponibili (torneo + season id)
  - `get_player_season_stats(player_id: int, ut_id: int, season_id: int) -> dict` — statistiche aggregate del giocatore in quella stagione
  - `SofaCliError(Exception)`

- [ ] **Step 1: Scoperta degli endpoint reali (nessun codice, salva l'output)**

Il CLI espone i comandi base già noti (`sofascore-search`, `team players get-team`,
`player`, `player statistics get-player-seasons`). Manca da individuare il comando
per le statistiche aggregate di un giocatore in una stagione. Esegui:

```powershell
$cli = 'C:\Users\Mauro\printing-press\library\sofascore\sofascore-pp-cli.exe'
& $cli which "player season statistics" --agent
& $cli api player --agent
& $cli api statistics --agent
& $cli sofascore-search --q "Barella" --agent   # verifica shape risultato + ricava un playerId
```

Con il `playerId` ottenuto, prova il comando candidato indicato da `which`/`api`
(es. `player statistics get-player-season-statistics <playerId> ...` o endpoint
`/player/{id}/unique-tournament/{utId}/season/{seasonId}/statistics/overall`).
Verifica anche l'id Serie A: `& $cli sofascore-search --q "Serie A" --agent`
(atteso `uniqueTournament.id == 23`; se diverso correggi `SERIE_A_TOURNAMENT_ID`
in `config.py`). Annota i comandi funzionanti: vanno cablati nelle costanti
`_CMD_*` dello Step 4. Se un endpoint di season-stats NON esiste nel CLI, usa il
fallback documentato nello Step 4 (nota finale).

- [ ] **Step 2: Scrivi i test (con runner finto — nessuna chiamata reale)**

`pipeline/tests/test_sofa_client.py`:
```python
import json
import subprocess
import pytest
from fantapipe import sofa_client
from fantapipe.sofa_client import SofaCliError


class FakeCompleted:
    def __init__(self, stdout, returncode=0, stderr=""):
        self.stdout, self.returncode, self.stderr = stdout, returncode, stderr


def test_run_cli_parses_json(monkeypatch):
    captured = {}

    def fake_run(cmd, **kw):
        captured["cmd"] = cmd
        return FakeCompleted(json.dumps({"ok": 1}))

    monkeypatch.setattr(subprocess, "run", fake_run)
    out = sofa_client.run_cli(["version"])
    assert out == {"ok": 1}
    assert "--agent" in captured["cmd"]          # sempre modalità agent
    assert captured["cmd"][0].endswith("sofascore-pp-cli.exe")


def test_run_cli_raises_on_error(monkeypatch):
    monkeypatch.setattr(subprocess, "run",
                        lambda cmd, **kw: FakeCompleted("", 1, "boom"))
    with pytest.raises(SofaCliError):
        sofa_client.run_cli(["player", "999"])


def test_get_team_squad_unwraps_players(monkeypatch):
    payload = {"players": [{"player": {"id": 1, "name": "A", "position": "M"}}]}
    monkeypatch.setattr(sofa_client, "run_cli", lambda args: payload)
    squad = sofa_client.get_team_squad(42)
    assert squad[0]["player"]["name"] == "A"


def test_search_team_returns_first_team_id(monkeypatch):
    payload = {"results": [
        {"type": "team", "entity": {"id": 2697, "name": "Inter"}},
        {"type": "player", "entity": {"id": 5, "name": "Interisti FC"}},
    ]}
    monkeypatch.setattr(sofa_client, "run_cli", lambda args: payload)
    assert sofa_client.search_team("Inter") == 2697


def test_search_team_none_when_missing(monkeypatch):
    monkeypatch.setattr(sofa_client, "run_cli", lambda args: {"results": []})
    assert sofa_client.search_team("Sconosciuta") is None
```

- [ ] **Step 3: Esegui i test — devono FALLIRE (modulo inesistente)**

Run: `.venv\Scripts\python -m pytest tests\test_sofa_client.py -v`
Expected: FAIL import error

- [ ] **Step 4: Implementa `fantapipe/sofa_client.py`**

```python
import json
import subprocess
from fantapipe import config


class SofaCliError(Exception):
    def __init__(self, cmd, returncode, stderr):
        super().__init__(f"sofascore-pp-cli failed ({returncode}): {' '.join(cmd)}\n{stderr}")
        self.cmd, self.returncode, self.stderr = cmd, returncode, stderr


def run_cli(args: list[str]) -> dict | list:
    cmd = [str(config.SOFA_CLI), *args, "--agent"]
    proc = subprocess.run(cmd, capture_output=True, text=True,
                          encoding="utf-8", timeout=120)
    if proc.returncode != 0:
        raise SofaCliError(cmd, proc.returncode, proc.stderr)
    return json.loads(proc.stdout)


# --- Comandi cablati dopo la scoperta dello Step 1 (adatta SOLO queste liste) ---
def _cmd_team_squad(team_id):      return ["team", "players", "get-team", str(team_id)]
def _cmd_search(query):            return ["sofascore-search", "--q", query]
def _cmd_player(player_id):        return ["player", str(player_id)]
def _cmd_player_seasons(player_id):
    return ["player", "statistics", "get-player-seasons", str(player_id)]
def _cmd_player_season_stats(player_id, ut_id, season_id):
    # Sostituisci col comando verificato nello Step 1.
    return ["player", "statistics", "get-player-season-statistics",
            str(player_id), str(ut_id), str(season_id)]


def get_team_squad(team_id: int) -> list[dict]:
    return run_cli(_cmd_team_squad(team_id)).get("players", [])


def search_team(name: str) -> int | None:
    data = run_cli(_cmd_search(name))
    for r in data.get("results", []):
        if r.get("type") == "team":
            return r["entity"]["id"]
    return None


def get_player(player_id: int) -> dict:
    return run_cli(_cmd_player(player_id))


def get_player_seasons(player_id: int) -> list[dict]:
    data = run_cli(_cmd_player_seasons(player_id))
    return data.get("uniqueTournamentSeasons", data) if isinstance(data, dict) else data


def get_player_season_stats(player_id: int, ut_id: int, season_id: int) -> dict:
    return run_cli(_cmd_player_season_stats(player_id, ut_id, season_id))
```

Nota fallback: se lo Step 1 mostra che il CLI non ha un endpoint season-stats per
giocatore, usa `unique-tournament season get-tournament-top-players <utId> <seasonId>`
(che restituisce le statistiche aggregate di TUTTI i giocatori del torneo/stagione)
e in Task 5 estrai il giocatore per id da quella lista, cacheando la risposta per
torneo+stagione. In quel caso `_cmd_player_season_stats` diventa
`["unique-tournament", "season", "get-tournament-top-players", str(ut_id), str(season_id)]`
e il filtro per player_id avviene in `career.py`.

- [ ] **Step 5: Esegui i test — devono PASSARE**

Run: `.venv\Scripts\python -m pytest tests\test_sofa_client.py -v`
Expected: PASS (5 test)

- [ ] **Step 6: Verifica reale una-tantum (fuori dai test)**

```powershell
.venv\Scripts\python -c "from fantapipe import sofa_client as s; tid = s.search_team('Inter'); print(tid); print(s.get_team_squad(tid)[0])"
```
Expected: stampa un team id numerico e il primo giocatore della rosa. Se lo shape
JSON reale differisce dai test (es. chiave diversa da `results`/`players`), correggi
implementazione E test finti per riflettere lo shape reale.

- [ ] **Step 7: Commit**

```powershell
git add pipeline/fantapipe/sofa_client.py pipeline/tests/test_sofa_client.py pipeline/fantapipe/config.py
git commit -m "feat: sofascore CLI wrapper with agent-mode JSON parsing"
```

---

### Task 3: Import del listone (Excel Fantacalcio.it)

**Files:**
- Create: `pipeline/fantapipe/listone.py`
- Test: `pipeline/tests/test_listone.py`

**Interfaces:**
- Produces: `load_listone(path: Path) -> pd.DataFrame` con colonne normalizzate
  `id:int, nome:str, ruolo:str (P|D|C|A), squadra:str, qta:int, fvm:int` e
  `ListoneError(Exception)` con messaggio che elenca le colonne trovate.

- [ ] **Step 1: Scrivi i test con fixture Excel generata al volo**

`pipeline/tests/test_listone.py`:
```python
import pytest
from openpyxl import Workbook
from fantapipe.listone import load_listone, ListoneError


def make_xlsx(path, rows, header=("Id", "R", "Nome", "Squadra", "Qt.A", "FVM"),
              title_row=True):
    wb = Workbook()
    ws = wb.active
    if title_row:  # il file reale ha una riga titolo prima dell'header
        ws.append(["Quotazioni Fantacalcio - Stagione 2026-27"])
    ws.append(list(header))
    for r in rows:
        ws.append(list(r))
    wb.save(path)


def test_load_listone_normalizza(tmp_path):
    f = tmp_path / "quot.xlsx"
    make_xlsx(f, [
        [2170, "C", "Barella", "Inter", 28, 120],
        [105, "P", "Meret", "Napoli", 12, 40],
    ])
    df = load_listone(f)
    assert list(df.columns) == ["id", "nome", "ruolo", "squadra", "qta", "fvm"]
    assert len(df) == 2
    barella = df[df.id == 2170].iloc[0]
    assert barella.ruolo == "C" and barella.qta == 28


def test_header_su_prima_riga(tmp_path):
    f = tmp_path / "quot.xlsx"
    make_xlsx(f, [[1, "A", "Kean", "Fiorentina", 20, 80]], title_row=False)
    assert len(load_listone(f)) == 1


def test_ruolo_non_valido_scartato_con_warning(tmp_path):
    f = tmp_path / "quot.xlsx"
    make_xlsx(f, [
        [1, "A", "Kean", "Fiorentina", 20, 80],
        [2, "X", "Errato", "Inter", 1, 1],
    ])
    df = load_listone(f)
    assert len(df) == 1 and df.iloc[0].nome == "Kean"


def test_colonne_mancanti_errore_esplicito(tmp_path):
    f = tmp_path / "quot.xlsx"
    make_xlsx(f, [[1, "A", "Kean", "Fiorentina", 20, 80]],
              header=("Codice", "Ruolo", "Giocatore", "Team", "Prezzo", "Valore"))
    with pytest.raises(ListoneError) as e:
        load_listone(f)
    assert "Codice" in str(e.value)  # elenca le colonne trovate
```

- [ ] **Step 2: Esegui — FAIL (modulo inesistente)**

Run: `.venv\Scripts\python -m pytest tests\test_listone.py -v`

- [ ] **Step 3: Implementa `fantapipe/listone.py`**

```python
from pathlib import Path
import pandas as pd
from fantapipe import config

# nomi colonna del file ufficiale -> nomi normalizzati (chiavi in lowercase)
COLMAP = {"id": "id", "r": "ruolo", "nome": "nome", "squadra": "squadra",
          "qt.a": "qta", "fvm": "fvm"}


class ListoneError(Exception):
    pass


def _find_header_row(raw: pd.DataFrame) -> int | None:
    for i in range(min(5, len(raw))):
        cells = {str(c).strip().lower() for c in raw.iloc[i].tolist()}
        if {"id", "r", "nome"} <= cells:
            return i
    return None


def load_listone(path: Path) -> pd.DataFrame:
    raw = pd.read_excel(path, header=None)
    hrow = _find_header_row(raw)
    if hrow is None:
        found = [str(c) for c in raw.iloc[0].tolist()]
        raise ListoneError(f"Header non trovato nelle prime 5 righe. Prima riga: {found}")
    df = pd.read_excel(path, header=hrow)
    df.columns = [str(c).strip().lower() for c in df.columns]
    missing = [c for c in COLMAP if c not in df.columns]
    if missing:
        raise ListoneError(
            f"Colonne mancanti {missing}. Colonne trovate: {list(df.columns)}")
    df = df[list(COLMAP)].rename(columns=COLMAP)
    df = df[df.ruolo.isin(config.RUOLI)].copy()
    df["id"] = df.id.astype(int)
    df["qta"] = pd.to_numeric(df.qta, errors="coerce").fillna(1).astype(int)
    df["fvm"] = pd.to_numeric(df.fvm, errors="coerce").fillna(1).astype(int)
    df["nome"] = df.nome.astype(str).str.strip()
    df["squadra"] = df.squadra.astype(str).str.strip()
    return df.reset_index(drop=True)
```

- [ ] **Step 4: Esegui — PASS (4 test)**

Run: `.venv\Scripts\python -m pytest tests\test_listone.py -v`

- [ ] **Step 5: Verifica sul file reale (una-tantum)**

Scarica manualmente l'export quotazioni da fantacalcio.it (Quotazioni → esporta
Excel) in `pipeline\data\listone\quotazioni_<oggi>.xlsx`, poi:
```powershell
.venv\Scripts\python -c "from pathlib import Path; from fantapipe.listone import load_listone; import sys; df = load_listone(sorted(Path('data/listone').glob('*.xlsx'))[-1]); print(len(df), 'giocatori'); print(df.head())"
```
Expected: ~500-650 giocatori. Se `ListoneError` elenca colonne diverse, aggiorna
`COLMAP` (e i test fixture) con i nomi reali.

- [ ] **Step 6: Commit**

```powershell
git add pipeline/fantapipe/listone.py pipeline/tests/test_listone.py
git commit -m "feat: listone excel import with header auto-detect and validation"
```

---

### Task 4: Indice rose SofaScore + matching nomi

**Files:**
- Create: `pipeline/fantapipe/matching.py`
- Test: `pipeline/tests/test_matching.py`

**Interfaces:**
- Consumes: `sofa_client.search_team`, `sofa_client.get_team_squad`, `config.TEAM_ALIASES`
- Produces:
  - `build_sofa_index(squadre: list[str], client=sofa_client) -> tuple[dict[str, list[dict]], list[str]]` —
    primo elemento: mappa `squadra_listone -> [{"sofaId": int, "nome": str}, ...]`
    (lista vuota per squadre senza alias o senza team trovato); secondo elemento:
    lista di warning testuali per le squadre non risolte
  - `match_players(listone: pd.DataFrame, index: dict, overrides: dict[int, int]) -> pd.DataFrame` —
    aggiunge colonne `sofa_id (Int64, NaN se non matchato)`, `match_score: float`,
    `match_status: str ("exact"|"fuzzy"|"override"|"dubbio"|"nessuno")`
  - `load_overrides(path: Path) -> dict[int, int]` e
    `write_report(df: pd.DataFrame, path: Path) -> None` (CSV con dubbi+nessuno)
  - `normalize_name(s: str) -> str`

- [ ] **Step 1: Scrivi i test**

`pipeline/tests/test_matching.py`:
```python
import pandas as pd
from fantapipe import matching


def _listone(rows):
    return pd.DataFrame(rows, columns=["id", "nome", "ruolo", "squadra", "qta", "fvm"])


INDEX = {"Inter": [{"sofaId": 1, "nome": "Nicolò Barella"},
                   {"sofaId": 2, "nome": "Lautaro Martínez"},
                   {"sofaId": 3, "nome": "Federico Dimarco"}],
         "Napoli": [{"sofaId": 9, "nome": "Alex Meret"}]}


def test_normalize_name():
    assert matching.normalize_name("Lautaro Martínez") == "lautaro martinez"
    assert matching.normalize_name("MARTINEZ L.") == "martinez l"


def test_match_exact_cognome():
    df = matching.match_players(_listone([[10, "Barella", "C", "Inter", 28, 120]]),
                                INDEX, {})
    assert df.iloc[0].sofa_id == 1 and df.iloc[0].match_status in ("exact", "fuzzy")


def test_match_fuzzy_con_iniziale():
    df = matching.match_players(_listone([[11, "Martinez L.", "A", "Inter", 34, 200]]),
                                INDEX, {})
    assert df.iloc[0].sofa_id == 2


def test_override_vince():
    df = matching.match_players(_listone([[12, "Barella", "C", "Inter", 28, 120]]),
                                INDEX, {12: 3})
    assert df.iloc[0].sofa_id == 3 and df.iloc[0].match_status == "override"


def test_nessun_match_resta_nan():
    df = matching.match_players(_listone([[13, "Sconosciuto", "A", "Napoli", 5, 10]]),
                                INDEX, {})
    assert pd.isna(df.iloc[0].sofa_id) and df.iloc[0].match_status == "nessuno"


def test_squadra_fuori_indice_va_in_nessuno():
    df = matching.match_players(_listone([[14, "Tizio", "D", "Pisa", 4, 8]]),
                                {"Inter": INDEX["Inter"]}, {})
    assert df.iloc[0].match_status == "nessuno"


def test_build_sofa_index_con_client_finto():
    class FakeClient:
        def search_team(self, name):
            return {"Inter": 100}.get(name)
        def get_team_squad(self, team_id):
            return [{"player": {"id": 1, "name": "Nicolò Barella", "position": "M"}}]
    idx, warns = matching.build_sofa_index(["Inter", "AtlantideFC"], client=FakeClient())
    assert idx["Inter"][0]["nome"] == "Nicolò Barella"
    assert idx["AtlantideFC"] == [] and any("AtlantideFC" in w for w in warns)


def test_report_scrive_dubbi(tmp_path):
    df = matching.match_players(_listone([[13, "Sconosciuto", "A", "Napoli", 5, 10]]),
                                INDEX, {})
    out = tmp_path / "report.csv"
    matching.write_report(df, out)
    assert "Sconosciuto" in out.read_text(encoding="utf-8")
```

- [ ] **Step 2: Esegui — FAIL**

Run: `.venv\Scripts\python -m pytest tests\test_matching.py -v`

- [ ] **Step 3: Implementa `fantapipe/matching.py`**

```python
import csv
import unicodedata
from pathlib import Path
import pandas as pd
from rapidfuzz import fuzz
from fantapipe import config, sofa_client

AUTO_THRESHOLD = 88      # >= match automatico
DUBBIO_THRESHOLD = 70    # tra i due -> "dubbio" (matcha comunque il migliore)


def normalize_name(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return " ".join(s.lower().replace(".", " ").replace("'", " ").split())


def build_sofa_index(squadre, client=sofa_client):
    index, warnings = {}, []
    for sq in squadre:
        alias = config.TEAM_ALIASES.get(sq)
        team_id = client.search_team(alias) if alias else None
        if team_id is None:
            index[sq] = []
            warnings.append(f"Squadra non risolta su SofaScore: {sq} (alias: {alias})")
            continue
        squad = client.get_team_squad(team_id)
        index[sq] = [{"sofaId": p["player"]["id"], "nome": p["player"]["name"]}
                     for p in squad if "player" in p]
    return index, warnings


def _best_match(nome_listone: str, candidates: list[dict]):
    target = normalize_name(nome_listone)
    best, best_score = None, 0.0
    for c in candidates:
        cand = normalize_name(c["nome"])
        # il listone usa "COGNOME I." -> confronta anche col solo cognome
        score = max(fuzz.token_set_ratio(target, cand),
                    fuzz.partial_ratio(target, cand))
        if score > best_score:
            best, best_score = c, score
    return best, best_score


def match_players(listone: pd.DataFrame, index: dict, overrides: dict) -> pd.DataFrame:
    df = listone.copy()
    ids, scores, statuses = [], [], []
    for row in df.itertuples():
        if row.id in overrides:
            ids.append(overrides[row.id]); scores.append(100.0); statuses.append("override")
            continue
        best, score = _best_match(row.nome, index.get(row.squadra, []))
        if best is None or score < DUBBIO_THRESHOLD:
            ids.append(pd.NA); scores.append(score); statuses.append("nessuno")
        elif score >= AUTO_THRESHOLD:
            status = "exact" if score >= 99.5 else "fuzzy"
            ids.append(best["sofaId"]); scores.append(score); statuses.append(status)
        else:
            ids.append(best["sofaId"]); scores.append(score); statuses.append("dubbio")
    df["sofa_id"] = pd.array(ids, dtype="Int64")
    df["match_score"] = scores
    df["match_status"] = statuses
    return df


def load_overrides(path: Path) -> dict:
    if not path.exists():
        return {}
    with open(path, newline="", encoding="utf-8") as f:
        return {int(r["listone_id"]): int(r["sofa_id"]) for r in csv.DictReader(f)}


def write_report(df: pd.DataFrame, path: Path) -> None:
    rep = df[df.match_status.isin(["dubbio", "nessuno"])]
    path.parent.mkdir(parents=True, exist_ok=True)
    rep[["id", "nome", "squadra", "ruolo", "sofa_id", "match_score", "match_status"]] \
        .to_csv(path, index=False, encoding="utf-8")
```

- [ ] **Step 4: Esegui — PASS (8 test)**

Run: `.venv\Scripts\python -m pytest tests\test_matching.py -v`

- [ ] **Step 5: Commit**

```powershell
git add pipeline/fantapipe/matching.py pipeline/tests/test_matching.py
git commit -m "feat: fuzzy player matching between listone and sofascore squads"
```

---

### Task 5: Fetch carriere multi-campionato con cache

**Files:**
- Create: `pipeline/fantapipe/career.py`
- Test: `pipeline/tests/test_career.py`

**Interfaces:**
- Consumes: `sofa_client.get_player_seasons`, `sofa_client.get_player_season_stats`, `config.league_coeff`, `config.CACHE_DIR`
- Produces (usate dai Task 6-7):
  - `@dataclass SeasonStats`: `season: str, torneo: str, coeff: float, pg: int, min: int, gol: int, assist: int, amm: int, esp: int, rating: float | None, rig_calc: int, rig_segn: int, gol_subiti: int | None, clean_sheet: int | None, rig_parati: int | None, rig_subiti_affrontati: int | None`
  - `fetch_career(sofa_id: int, client=sofa_client, cache_dir: Path | None = None, max_age_days: int = 7) -> list[SeasonStats]` — ultime **4** stagioni, più recente per prima, cache JSON per giocatore
  - `career_to_jsonable(seasons: list[SeasonStats]) -> list[dict]` (chiavi camelCase come nel contratto dataset: `rigCalc`, `golSubiti`, ...)

- [ ] **Step 1: Scrivi i test**

`pipeline/tests/test_career.py`:
```python
import json
from fantapipe import career


RAW_SEASONS = [
    {"uniqueTournament": {"id": 23, "name": "Serie A"},
     "seasons": [{"id": 700, "year": "25/26"}, {"id": 600, "year": "24/25"}]},
    {"uniqueTournament": {"id": 17, "name": "Premier League"},
     "seasons": [{"id": 650, "year": "24/25"}]},
]

RAW_STATS = {"statistics": {
    "appearances": 30, "minutesPlayed": 2500, "goals": 5, "assists": 7,
    "yellowCards": 4, "redCards": 0, "rating": 7.1,
    "penaltiesTaken": 2, "penaltyGoals": 2,
    "goalsConcededOutsideTheBox": None, "cleanSheet": None,
    "savedShotsFromInsideTheBox": None, "penaltySave": None, "penaltyFaced": None,
}}


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
```

- [ ] **Step 2: Esegui — FAIL**

Run: `.venv\Scripts\python -m pytest tests\test_career.py -v`

- [ ] **Step 3: Implementa `fantapipe/career.py`**

```python
import json
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from fantapipe import config, sofa_client

MAX_SEASONS = 4


@dataclass
class SeasonStats:
    season: str
    torneo: str
    coeff: float
    pg: int
    min: int
    gol: int
    assist: int
    amm: int
    esp: int
    rating: float | None
    rig_calc: int
    rig_segn: int
    gol_subiti: int | None
    clean_sheet: int | None
    rig_parati: int | None
    rig_subiti_affrontati: int | None


def _year_key(year: str) -> int:
    # "25/26" -> 25; "2025" -> 25
    head = year.split("/")[0]
    return int(head[-2:])


def _int(v):  return int(v) if v is not None else 0
def _opt(v):  return int(v) if v is not None else None


def _normalize(raw_stats: dict, torneo: str, season_year: str) -> SeasonStats:
    s = raw_stats.get("statistics", raw_stats)
    return SeasonStats(
        season=season_year, torneo=torneo, coeff=config.league_coeff(torneo),
        pg=_int(s.get("appearances")), min=_int(s.get("minutesPlayed")),
        gol=_int(s.get("goals")), assist=_int(s.get("assists")),
        amm=_int(s.get("yellowCards")), esp=_int(s.get("redCards")),
        rating=s.get("rating"),
        rig_calc=_int(s.get("penaltiesTaken")), rig_segn=_int(s.get("penaltyGoals")),
        gol_subiti=_opt(s.get("goalsConceded")),
        clean_sheet=_opt(s.get("cleanSheet")),
        rig_parati=_opt(s.get("penaltySave")),
        rig_subiti_affrontati=_opt(s.get("penaltyFaced")),
    )


def fetch_career(sofa_id: int, client=sofa_client,
                 cache_dir: Path | None = None, max_age_days: int = 7):
    cache_dir = cache_dir or (config.CACHE_DIR / "players")
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_file = cache_dir / f"player_{sofa_id}.json"
    if cache_file.exists():
        age_days = (time.time() - cache_file.stat().st_mtime) / 86400
        if age_days <= max_age_days:
            data = json.loads(cache_file.read_text(encoding="utf-8"))
            return [SeasonStats(**d) for d in data]

    entries = []  # (year_key, torneo, season_id, year, ut_id)
    for t in client.get_player_seasons(sofa_id):
        torneo = t.get("uniqueTournament", {}).get("name", "?")
        for season in t.get("seasons", []):
            entries.append((_year_key(season["year"]), torneo,
                            season["id"], season["year"],
                            t.get("uniqueTournament", {}).get("id")))
    entries.sort(key=lambda e: e[0], reverse=True)

    seasons = []
    for _, torneo, season_id, year, ut_id in entries[:MAX_SEASONS]:
        raw = client.get_player_season_stats(sofa_id, ut_id, season_id)
        seasons.append(_normalize(raw, torneo, year))

    cache_file.write_text(json.dumps([asdict(s) for s in seasons]),
                          encoding="utf-8")
    return seasons


_JSON_KEYS = {"rig_calc": "rigCalc", "rig_segn": "rigSegn",
              "gol_subiti": "golSubiti", "clean_sheet": "cleanSheet",
              "rig_parati": "rigParati"}


def career_to_jsonable(seasons):
    out = []
    for s in seasons[:3]:  # nel dataset finiscono max 3 stagioni
        d = asdict(s)
        d.pop("rig_subiti_affrontati")
        for k_py, k_json in _JSON_KEYS.items():
            d[k_json] = d.pop(k_py)
        out.append(d)
    return out
```

Nota: i nomi chiave dello stats JSON reale (`goalsConceded`, `penaltySave`, ...)
vanno verificati con una chiamata reale nel Task 10 Step 3; se differiscono,
correggi SOLO `_normalize` e il fixture `RAW_STATS` nei test.

- [ ] **Step 4: Esegui — PASS (4 test)**

Run: `.venv\Scripts\python -m pytest tests\test_career.py -v`

- [ ] **Step 5: Commit**

```powershell
git add pipeline/fantapipe/career.py pipeline/tests/test_career.py
git commit -m "feat: multi-league career fetch with per-player cache"
```

---

### Task 6: Profilo caratteristiche (traits)

**Files:**
- Create: `pipeline/fantapipe/traits.py`
- Test: `pipeline/tests/test_traits.py`

**Interfaces:**
- Consumes: `career.SeasonStats`
- Produces: `compute_traits(seasons: list[SeasonStats], ruolo: str) -> list[str]` —
  sottoinsieme ordinato di `("rigorista", "assistman", "pararigori", "cartellino", "bonusdifesa", "durevole", "fragile")`
  e `trait_notes(traits: list[str]) -> list[str]` (frasi brevi in italiano per il campo `note`).

Soglie esatte (carriera = tutte le stagioni disponibili, per-game = totale/pg totali):
- `rigorista`: rig_calc totali ≥ 5 in carriera, OPPURE ≥ 3 nell'ultima stagione
- `assistman`: assist per partita ≥ 0.15 su tutta la carriera (pg totali ≥ 30)
- `pararigori` (solo P): rig_parati totali / rig_subiti_affrontati ≥ 0.25 con ≥ 8 affrontati
- `cartellino`: (amm + 3×esp) per partita ≥ 0.28 (pg totali ≥ 30)
- `bonusdifesa` (solo D e C): (gol + assist) per partita ≥ 0.15 (pg ≥ 30)
- `durevole`: quota minuti media ≥ 0.70 nelle ultime 3 stagioni (minuti/3420 per stagione, clamp 1.0)
- `fragile`: quota minuti media ≤ 0.40 nelle ultime 3 stagioni (con pg carriera ≥ 20)

Nota: il trait `punizioni` (specialista calci piazzati, previsto dalla spec §4.3) è
riservato nel contratto dataset ma NON viene emesso in v1: le statistiche aggregate
SofaScore non espongono in modo affidabile i gol su punizione. La chiave resta nel
contratto e in `NOTES` per un'estensione futura senza rompere l'app.

- [ ] **Step 1: Scrivi i test**

`pipeline/tests/test_traits.py`:
```python
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
```

- [ ] **Step 2: Esegui — FAIL**

Run: `.venv\Scripts\python -m pytest tests\test_traits.py -v`

- [ ] **Step 3: Implementa `fantapipe/traits.py`**

```python
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
```

- [ ] **Step 4: Esegui — PASS (8 test)**

Run: `.venv\Scripts\python -m pytest tests\test_traits.py -v`

- [ ] **Step 5: Commit**

```powershell
git add pipeline/fantapipe/traits.py pipeline/tests/test_traits.py
git commit -m "feat: player trait profile from multi-league career"
```

---

### Task 7: Proiezioni (voto, fantamedia, titolarità, valueScore)

**Files:**
- Create: `pipeline/fantapipe/projections.py`
- Test: `pipeline/tests/test_projections.py`

**Interfaces:**
- Consumes: `career.SeasonStats`, `config.rating_to_voto`, `config.RECENCY_WEIGHTS`, `config.BONUS`
- Produces: `@dataclass Projection(voto_proj: float, fm_proj: float, starts_share: float, value_score: float)` e
  `project(seasons: list[SeasonStats], ruolo: str) -> Projection`.
  Per giocatori senza carriera (`seasons == []`) esiste
  `project_from_qta(qta: int, ruolo: str) -> Projection` (fallback dalla sola quotazione).

Formule esatte:
- Pesi stagione: `RECENCY_WEIGHTS` rinormalizzati sulle stagioni disponibili (max 3), ma
  una stagione pesa solo se `pg ≥ 5` (altrimenti scartata).
- `voto_proj = Σ w_i × rating_to_voto(rating_i) ` con rating mancante → 6.6 neutro.
  Il rating estero viene prima riscalato: `rating_adj = 6.95 + (rating − 6.95) × coeff`.
- Statistiche per-game riscalate col coeff di lega: `gol_pg_i = (gol_i / pg_i) × coeff_i` (idem assist);
  malus NON riscalati (un'ammonizione pesa uguale ovunque).
- Movimento: `fm_proj = voto_proj + 3×gol_pg + 1×assist_pg − 0.5×amm_pg − 1×esp_pg`
- Portiere: `fm_proj = voto_proj − 1×gs_pg + 1×cs_pg + 3×rp_pg` (gs=gol subiti, cs=clean sheet, rp=rigori parati, tutti per-game, non riscalati)
- `starts_share = Σ w_i × min(1, min_i / 3420)`
- `value_score = round(max(0, fm_proj − 6.0) × starts_share × 38, 1)`
- `project_from_qta`: `value_score = qta × 0.8`, `fm_proj = 6.0 + qta/40`, `voto_proj = 6.0`, `starts_share = 0.5` (stima prudente, marcata poi con affidabilità bassa nel Task 8).

- [ ] **Step 1: Scrivi i test (valori calcolati a mano)**

`pipeline/tests/test_projections.py`:
```python
import pytest
from fantapipe.career import SeasonStats
from fantapipe.projections import project, project_from_qta


def mk(rating=7.0, gol=0, assist=0, amm=0, esp=0, pg=34, minuti=3060,
       coeff=1.0, torneo="Serie A", gs=None, cs=None, rp=None):
    return SeasonStats(season="25/26", torneo=torneo, coeff=coeff, pg=pg,
                       min=minuti, gol=gol, assist=assist, amm=amm, esp=esp,
                       rating=rating, rig_calc=0, rig_segn=0,
                       gol_subiti=gs, clean_sheet=cs, rig_parati=rp,
                       rig_subiti_affrontati=None)


def test_una_stagione_movimento_calcolo_a_mano():
    # rating 6.95 -> voto 6.0; 17 gol/34 pg = 0.5 gol_pg -> +1.5
    # 3.4 amm/34 = 0.1 -> -0.05 ; fm = 6.0 + 1.5 - 0.05 = 7.45
    p = project([mk(rating=6.95, gol=17, amm=3.4)], "A")
    assert p.voto_proj == pytest.approx(6.0, abs=0.01)
    assert p.fm_proj == pytest.approx(7.45, abs=0.02)
    # starts_share = 3060/3420 = 0.8947 ; value = 1.45 * 0.8947 * 38 = 49.3
    assert p.starts_share == pytest.approx(0.8947, abs=0.001)
    assert p.value_score == pytest.approx(49.3, abs=0.2)


def test_recency_pesa_ultima_stagione():
    buona_recente = project([mk(rating=7.3), mk(rating=6.6)], "C")
    buona_vecchia = project([mk(rating=6.6), mk(rating=7.3)], "C")
    assert buona_recente.fm_proj > buona_vecchia.fm_proj


def test_coeff_lega_riscala_i_gol():
    in_serie_a = project([mk(gol=10)], "A")
    in_eredivisie = project([mk(gol=10, coeff=0.75, torneo="Eredivisie")], "A")
    assert in_serie_a.fm_proj > in_eredivisie.fm_proj


def test_stagione_con_poche_presenze_scartata():
    p_solo_buona = project([mk(rating=7.2)], "C")
    p_con_spezzone = project([mk(rating=7.2), mk(rating=5.5, pg=3, minuti=200)], "C")
    assert p_con_spezzone.fm_proj == pytest.approx(p_solo_buona.fm_proj, abs=0.01)


def test_portiere():
    # voto 6.0; gs 34/34=1 -> -1 ; cs 10/34=0.294 -> +0.294 ; rp 3/34 -> +0.26
    p = project([mk(rating=6.95, gs=34, cs=10, rp=3)], "P")
    assert p.fm_proj == pytest.approx(6.0 - 1 + 0.294 + 0.265, abs=0.02)


def test_value_score_mai_negativo():
    p = project([mk(rating=5.8, amm=10)], "D")
    assert p.value_score == 0.0


def test_fallback_da_quotazione():
    p = project_from_qta(20, "A")
    assert p.value_score == pytest.approx(16.0)
    assert 6.0 < p.fm_proj < 7.0


def test_carriera_vuota_solleva():
    with pytest.raises(ValueError):
        project([], "A")
```

- [ ] **Step 2: Esegui — FAIL**

Run: `.venv\Scripts\python -m pytest tests\test_projections.py -v`

- [ ] **Step 3: Implementa `fantapipe/projections.py`**

```python
from dataclasses import dataclass
from fantapipe import config
from fantapipe.career import SeasonStats

MIN_PG = 5
NEUTRAL_RATING = 6.6
FULL_SEASON_MIN = 3420


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
    usable = [s for s in seasons if s.pg >= MIN_PG][:3]
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
    value = round(max(0.0, fm - 6.0) * share * 38, 1)
    return Projection(round(voto, 2), round(fm, 2), round(share, 4), value)


def project_from_qta(qta: int, ruolo: str) -> Projection:
    return Projection(voto_proj=6.0, fm_proj=round(6.0 + qta / 40, 2),
                      starts_share=0.5, value_score=round(qta * 0.8, 1))
```

- [ ] **Step 4: Esegui — PASS (8 test)**

Run: `.venv\Scripts\python -m pytest tests\test_projections.py -v`

- [ ] **Step 5: Commit**

```powershell
git add pipeline/fantapipe/projections.py pipeline/tests/test_projections.py
git commit -m "feat: fantamedia projection with recency weights and league coefficients"
```

---

### Task 8: Valutazione (fasce + affidabilità)

**Files:**
- Create: `pipeline/fantapipe/valuation.py`
- Test: `pipeline/tests/test_valuation.py`

**Interfaces:**
- Consumes: `career.SeasonStats`
- Produces:
  - `assign_fasce(df: pd.DataFrame) -> pd.Series` — input DataFrame con colonne `ruolo`, `value_score`; output Series `fascia` allineata all'indice. Percentili PER RUOLO su `value_score`: ≥97° `top`, ≥90° `semitop`, ≥70° `titolare`, ≥45° `scommessa`, sotto `lowcost`.
  - `affidabilita(seasons: list[SeasonStats], matched: bool) -> int` — 5..100:
    parte da 100; −60 se `not matched`; −20 se nessuna stagione Serie A in carriera;
    −15 se `len(seasons) < 2`; −(fino a 25) per discontinuità minuti:
    `25 × max(0, 0.7 − share_ultima_stagione) / 0.7` dove share = min/3420 dell'ultima stagione; clamp finale 5..100.

- [ ] **Step 1: Scrivi i test**

`pipeline/tests/test_valuation.py`:
```python
import pandas as pd
from fantapipe.valuation import assign_fasce, affidabilita
from fantapipe.career import SeasonStats


def mk(torneo="Serie A", minuti=3000):
    return SeasonStats(season="25/26", torneo=torneo, coeff=1.0, pg=34,
                       min=minuti, gol=0, assist=0, amm=0, esp=0, rating=7.0,
                       rig_calc=0, rig_segn=0, gol_subiti=None,
                       clean_sheet=None, rig_parati=None,
                       rig_subiti_affrontati=None)


def test_fasce_percentili_per_ruolo():
    df = pd.DataFrame({
        "ruolo": ["A"] * 100,
        "value_score": [float(i) for i in range(100)],
    })
    fasce = assign_fasce(df)
    assert fasce.iloc[99] == "top"
    assert fasce.iloc[95] == "semitop"
    assert fasce.iloc[80] == "titolare"
    assert fasce.iloc[50] == "scommessa"
    assert fasce.iloc[10] == "lowcost"


def test_fasce_indipendenti_tra_ruoli():
    df = pd.DataFrame({
        "ruolo": ["A"] * 50 + ["P"] * 50,
        "value_score": [float(i) for i in range(50)] + [float(i) for i in range(50)],
    })
    fasce = assign_fasce(df)
    # il miglior portiere è top anche se i suoi score assoluti sono uguali agli attaccanti
    assert fasce.iloc[99] == "top" and fasce.iloc[49] == "top"


def test_affidabilita_matchato_pieno():
    assert affidabilita([mk(), mk(), mk()], matched=True) == 100


def test_affidabilita_non_matchato():
    assert affidabilita([], matched=False) <= 40


def test_affidabilita_senza_serie_a():
    v = affidabilita([mk(torneo="Premier League"), mk(torneo="Premier League")],
                     matched=True)
    assert v == 80


def test_affidabilita_minutaggio_basso():
    pieno = affidabilita([mk(minuti=3400), mk()], matched=True)
    scarso = affidabilita([mk(minuti=800), mk()], matched=True)
    assert scarso < pieno


def test_clamp_minimo_5():
    assert affidabilita([], matched=False) >= 5
```

- [ ] **Step 2: Esegui — FAIL**

Run: `.venv\Scripts\python -m pytest tests\test_valuation.py -v`

- [ ] **Step 3: Implementa `fantapipe/valuation.py`**

```python
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
```

- [ ] **Step 4: Esegui — PASS (7 test)**

Run: `.venv\Scripts\python -m pytest tests\test_valuation.py -v`

- [ ] **Step 5: Commit**

```powershell
git add pipeline/fantapipe/valuation.py pipeline/tests/test_valuation.py
git commit -m "feat: per-role tier assignment and reliability index"
```

---

### Task 9: Assemblaggio `dataset.json`

**Files:**
- Create: `pipeline/fantapipe/dataset.py`
- Test: `pipeline/tests/test_dataset.py`

**Interfaces:**
- Consumes: tutti i moduli precedenti (`listone`, `matching`, `career`, `traits`, `projections`, `valuation`)
- Produces:
  - `build_dataset(matched_df: pd.DataFrame, careers: dict[int, list[SeasonStats]], season_label: str, quotazioni_file: str, now_iso: str) -> dict` — il dict conforme al contratto in testa al piano. `careers` è indicizzato per `sofa_id`.
  - `validate_dataset(ds: dict) -> list[str]` — lista di problemi (vuota se ok)
  - `write_dataset(ds: dict, path: Path) -> None` — JSON UTF-8, `ensure_ascii=False`

Regole di `validate_dataset` (ognuna produce una stringa di errore):
- `schemaVersion == 1`; `players` non vuoto; ogni player ha tutte le chiavi del contratto
- `valueScore >= 0`; `affidabilita` in 5..100; `fascia` tra le 5 valide; `ruolo` in RUOLI
- id listone univoci; per ogni ruolo esiste almeno 1 giocatore

- [ ] **Step 1: Scrivi i test**

`pipeline/tests/test_dataset.py`:
```python
import json
import pandas as pd
from fantapipe import dataset
from fantapipe.career import SeasonStats


def _matched_df():
    return pd.DataFrame({
        "id": [1, 2, 3, 4],
        "nome": ["Barella", "Meret", "Bastoni", "Kean"],
        "ruolo": ["C", "P", "D", "A"],
        "squadra": ["Inter", "Napoli", "Inter", "Fiorentina"],
        "qta": [28, 12, 20, 22],
        "fvm": [120, 40, 90, 100],
        "sofa_id": pd.array([100, 101, 102, pd.NA], dtype="Int64"),
        "match_status": ["exact", "fuzzy", "exact", "nessuno"],
    })


def _career():
    return [SeasonStats(season="25/26", torneo="Serie A", coeff=1.0, pg=34,
                        min=3000, gol=4, assist=8, amm=5, esp=0, rating=7.2,
                        rig_calc=0, rig_segn=0, gol_subiti=None,
                        clean_sheet=None, rig_parati=None,
                        rig_subiti_affrontati=None)]


def _build():
    careers = {100: _career(), 101: _career(), 102: _career()}
    return dataset.build_dataset(_matched_df(), careers, "2026-27",
                                 "quot.xlsx", "2026-08-12T07:00:00+00:00")


def test_struttura_e_contratto():
    ds = _build()
    assert ds["schemaVersion"] == 1 and ds["season"] == "2026-27"
    assert len(ds["players"]) == 4
    p = ds["players"][0]
    for k in ("id", "sofaId", "nome", "ruolo", "squadra", "qta", "fvm", "fascia",
              "valueScore", "fmProj", "votoProj", "startsShare", "affidabilita",
              "traits", "note", "seasons"):
        assert k in p, k


def test_non_matchato_fallback():
    ds = _build()
    kean = [p for p in ds["players"] if p["nome"] == "Kean"][0]
    assert kean["sofaId"] is None and kean["seasons"] == []
    assert kean["affidabilita"] <= 40 and kean["valueScore"] > 0


def test_validate_ok():
    assert dataset.validate_dataset(_build()) == []


def test_validate_trova_problemi():
    ds = _build()
    ds["players"][0]["valueScore"] = -1
    ds["players"][1]["fascia"] = "media"
    problems = dataset.validate_dataset(ds)
    assert len(problems) >= 2


def test_write_utf8(tmp_path):
    out = tmp_path / "dataset.json"
    dataset.write_dataset(_build(), out)
    loaded = json.loads(out.read_text(encoding="utf-8"))
    assert loaded["players"][0]["nome"] == "Barella"
```

- [ ] **Step 2: Esegui — FAIL**

Run: `.venv\Scripts\python -m pytest tests\test_dataset.py -v`

- [ ] **Step 3: Implementa `fantapipe/dataset.py`**

```python
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
                  quotazioni_file: str, now_iso: str) -> dict:
    rows = []
    for r in matched_df.itertuples():
        sofa_id = None if pd.isna(r.sofa_id) else int(r.sofa_id)
        seasons = careers.get(sofa_id, []) if sofa_id else []
        try:
            proj = project(seasons, r.ruolo)
        except ValueError:
            proj = project_from_qta(r.qta, r.ruolo)
            seasons = []
        traits = compute_traits(seasons, r.ruolo)
        aff = affidabilita(seasons, matched=sofa_id is not None)
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
    return {"schemaVersion": 1, "generatedAt": now_iso, "season": season_label,
            "quotazioniFile": quotazioni_file, "players": rows}


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
    return problems


def write_dataset(ds: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(ds, ensure_ascii=False, separators=(",", ":")),
                    encoding="utf-8")
```

- [ ] **Step 4: Esegui — PASS (5 test)**

Run: `.venv\Scripts\python -m pytest tests\test_dataset.py -v`

- [ ] **Step 5: Commit**

```powershell
git add pipeline/fantapipe/dataset.py pipeline/tests/test_dataset.py
git commit -m "feat: dataset.json assembly with contract validation"
```

---

### Task 10: Orchestratore CLI end-to-end

**Files:**
- Create: `pipeline/fantapipe/cli.py`
- Test: `pipeline/tests/test_cli.py`

**Interfaces:**
- Consumes: tutti i moduli precedenti
- Produces: `python -m fantapipe.cli --listone <path.xlsx> [--skip-publish] [--max-age-days N]`
  e la funzione `run_pipeline(listone_path: Path, client=sofa_client, cache_dir=None, out_path=None, now_iso=None) -> dict` (ritorna il dataset; scrive `out_path`, `matching_report.csv` e `run_log.txt` in `PIPE_DATA`).

- [ ] **Step 1: Scrivi il test end-to-end (client finto, nessuna rete)**

`pipeline/tests/test_cli.py`:
```python
import json
from openpyxl import Workbook
from fantapipe.cli import run_pipeline


class FakeClient:
    def search_team(self, name):
        return 100
    def get_team_squad(self, team_id):
        return [{"player": {"id": 500, "name": "Nicolò Barella", "position": "M"}},
                {"player": {"id": 501, "name": "Alex Meret", "position": "G"}},
                {"player": {"id": 502, "name": "Alessandro Bastoni", "position": "D"}},
                {"player": {"id": 503, "name": "Moise Kean", "position": "F"}}]
    def get_player_seasons(self, pid):
        return [{"uniqueTournament": {"id": 23, "name": "Serie A"},
                 "seasons": [{"id": 700, "year": "25/26"}]}]
    def get_player_season_stats(self, pid, ut_id, season_id):
        return {"statistics": {"appearances": 34, "minutesPlayed": 3000,
                               "goals": 4, "assists": 6, "yellowCards": 3,
                               "redCards": 0, "rating": 7.0,
                               "penaltiesTaken": 0, "penaltyGoals": 0}}


def _make_listone(path):
    wb = Workbook(); ws = wb.active
    ws.append(["Quotazioni 2026-27"])
    ws.append(["Id", "R", "Nome", "Squadra", "Qt.A", "FVM"])
    for row in [[1, "C", "Barella", "Inter", 28, 120],
                [2, "P", "Meret", "Inter", 12, 40],
                [3, "D", "Bastoni", "Inter", 20, 90],
                [4, "A", "Kean", "Inter", 22, 100]]:
        ws.append(row)
    wb.save(path)


def test_run_pipeline_end_to_end(tmp_path):
    listone = tmp_path / "quot.xlsx"
    _make_listone(listone)
    out = tmp_path / "dataset.json"
    ds = run_pipeline(listone, client=FakeClient(), cache_dir=tmp_path / "cache",
                      out_path=out, now_iso="2026-08-12T07:00:00+00:00")
    assert out.exists()
    loaded = json.loads(out.read_text(encoding="utf-8"))
    assert len(loaded["players"]) == 4
    assert all(p["sofaId"] is not None for p in loaded["players"])
    assert loaded["generatedAt"] == "2026-08-12T07:00:00+00:00"
```

- [ ] **Step 2: Esegui — FAIL**

Run: `.venv\Scripts\python -m pytest tests\test_cli.py -v`

- [ ] **Step 3: Implementa `fantapipe/cli.py`**

```python
import argparse
import datetime
import sys
from pathlib import Path
from fantapipe import config, sofa_client
from fantapipe.career import fetch_career
from fantapipe.dataset import build_dataset, validate_dataset, write_dataset
from fantapipe.listone import load_listone
from fantapipe.matching import (build_sofa_index, load_overrides,
                                match_players, write_report)


def _season_label(now: datetime.date) -> str:
    y = now.year if now.month >= 7 else now.year - 1
    return f"{y}-{str(y + 1)[-2:]}"


def run_pipeline(listone_path: Path, client=sofa_client, cache_dir=None,
                 out_path=None, now_iso=None, max_age_days=7):
    out_path = out_path or config.DATASET_OUT
    now = datetime.datetime.now(datetime.UTC)
    now_iso = now_iso or now.isoformat(timespec="seconds")
    log = []

    df = load_listone(listone_path)
    log.append(f"listone: {len(df)} giocatori da {listone_path.name}")

    index, warns = build_sofa_index(sorted(df.squadra.unique()), client=client)
    log.extend(warns)
    overrides = load_overrides(config.PIPE_DATA / "matching_overrides.csv")
    matched = match_players(df, index, overrides)
    write_report(matched, config.PIPE_DATA / "matching_report.csv")
    n_ok = int(matched.sofa_id.notna().sum())
    log.append(f"matching: {n_ok}/{len(matched)} matchati "
               f"({(matched.match_status == 'dubbio').sum()} dubbi)")

    careers = {}
    for sofa_id in matched.sofa_id.dropna().astype(int).unique():
        try:
            careers[int(sofa_id)] = fetch_career(int(sofa_id), client=client,
                                                 cache_dir=cache_dir,
                                                 max_age_days=max_age_days)
        except Exception as e:  # un giocatore fallito non ferma la pipeline
            log.append(f"carriera fallita per sofaId={sofa_id}: {e}")
            careers[int(sofa_id)] = []

    ds = build_dataset(matched, careers, _season_label(now.date()),
                       listone_path.name, now_iso)
    problems = validate_dataset(ds)
    if problems:
        raise SystemExit("dataset non valido:\n" + "\n".join(problems))
    write_dataset(ds, out_path)
    log.append(f"dataset scritto: {out_path} ({len(ds['players'])} giocatori)")

    config.PIPE_DATA.mkdir(parents=True, exist_ok=True)
    (config.PIPE_DATA / "run_log.txt").write_text("\n".join(log), encoding="utf-8")
    print("\n".join(log))
    return ds


def main(argv=None):
    ap = argparse.ArgumentParser(prog="fantapipe")
    ap.add_argument("--listone", type=Path, required=True)
    ap.add_argument("--max-age-days", type=int, default=7)
    args = ap.parse_args(argv)
    run_pipeline(args.listone, max_age_days=args.max_age_days)


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Esegui tutti i test — PASS**

Run: `.venv\Scripts\python -m pytest tests -v`
Expected: PASS (tutti i task finora)

- [ ] **Step 5: Prima esecuzione reale**

```powershell
Set-Location D:\railway\fantacalcio\pipeline
$listone = (Get-ChildItem data\listone\*.xlsx | Sort-Object Name | Select-Object -Last 1).FullName
.venv\Scripts\python -m fantapipe.cli --listone $listone
```
Expected: log con conteggi, `D:\railway\fantacalcio\data\dataset.json` creato.
ATTENZIONE: la prima run fa ~600 giocatori × 2-5 chiamate a 2 req/s → 20-60 minuti.
Le run successive usano la cache. Controlla `pipeline\data\matching_report.csv`:
per i "dubbi" evidenti aggiungi righe a `pipeline\data\matching_overrides.csv`
(colonne: `listone_id,sofa_id`) e rilancia (veloce, cache attiva).
Se `get_player_season_stats` reale restituisce chiavi diverse da quelle attese,
aggiorna `career._normalize` + fixture nei test (vedi nota Task 5).

- [ ] **Step 6: Commit**

```powershell
git add pipeline/fantapipe/cli.py pipeline/tests/test_cli.py
git commit -m "feat: end-to-end pipeline orchestrator CLI"
```

---

### Task 11: Pubblicazione su GitHub

**Files:**
- Create: `pipeline/fantapipe/publish.py`
- Test: `pipeline/tests/test_publish.py`
- Modify: `pipeline/fantapipe/cli.py` (aggiunge `--skip-publish`)

**Interfaces:**
- Produces: `publish_dataset(repo_root: Path, dataset_rel: str = "data/dataset.json", remote: str = "origin", branch: str = "master") -> bool` — `git add/commit/push` del solo dataset; ritorna `False` (senza errore) se non ci sono modifiche; solleva `PublishError` su push fallito.

- [ ] **Step 1: Setup GitHub una-tantum (manuale, fuori dai test)**

```powershell
gh auth status
# se non autenticato: gh auth login  (browser flow)
Set-Location D:\railway\fantacalcio
gh repo create fantacalcio --public --source . --remote origin --push
```
Expected: repo `github.com/<user>/fantacalcio` creato, branch `master` pushato.
Annota l'URL raw che servirà all'app:
`https://raw.githubusercontent.com/<user>/fantacalcio/master/data/dataset.json`
Scrivilo in `pipeline/README.md`.

- [ ] **Step 2: Scrivi i test (remote = bare repo locale, niente rete)**

`pipeline/tests/test_publish.py`:
```python
import subprocess
from pathlib import Path
import pytest
from fantapipe.publish import publish_dataset, PublishError


def _git(cwd, *args):
    return subprocess.run(["git", "-C", str(cwd), *args],
                          capture_output=True, text=True, check=True)


@pytest.fixture
def repo_con_remote(tmp_path):
    remote = tmp_path / "remote.git"
    subprocess.run(["git", "init", "--bare", str(remote)], check=True,
                   capture_output=True)
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init", "-b", "master")
    _git(repo, "config", "user.email", "t@t.it")
    _git(repo, "config", "user.name", "t")
    _git(repo, "remote", "add", "origin", str(remote))
    (repo / "data").mkdir()
    (repo / "data" / "dataset.json").write_text('{"v":1}', encoding="utf-8")
    _git(repo, "add", "."); _git(repo, "commit", "-m", "init")
    _git(repo, "push", "-u", "origin", "master")
    return repo


def test_publish_con_modifiche(repo_con_remote):
    (repo_con_remote / "data" / "dataset.json").write_text('{"v":2}',
                                                           encoding="utf-8")
    assert publish_dataset(repo_con_remote) is True
    log = _git(repo_con_remote, "log", "--oneline", "origin/master").stdout
    assert "data: dataset update" in log


def test_publish_senza_modifiche(repo_con_remote):
    assert publish_dataset(repo_con_remote) is False


def test_publish_push_fallito(repo_con_remote):
    _git(repo_con_remote, "remote", "set-url", "origin",
         str(repo_con_remote / "inesistente.git"))
    (repo_con_remote / "data" / "dataset.json").write_text('{"v":3}',
                                                           encoding="utf-8")
    with pytest.raises(PublishError):
        publish_dataset(repo_con_remote)
```

- [ ] **Step 3: Esegui — FAIL**

Run: `.venv\Scripts\python -m pytest tests\test_publish.py -v`

- [ ] **Step 4: Implementa `fantapipe/publish.py`**

```python
import datetime
import subprocess
from pathlib import Path


class PublishError(Exception):
    pass


def _git(repo_root: Path, *args, check=True):
    proc = subprocess.run(["git", "-C", str(repo_root), *args],
                          capture_output=True, text=True)
    if check and proc.returncode != 0:
        raise PublishError(f"git {' '.join(args)} fallito: {proc.stderr}")
    return proc


def publish_dataset(repo_root: Path, dataset_rel: str = "data/dataset.json",
                    remote: str = "origin", branch: str = "master") -> bool:
    _git(repo_root, "add", dataset_rel)
    diff = _git(repo_root, "diff", "--cached", "--quiet", "--", dataset_rel,
                check=False)
    if diff.returncode == 0:
        return False  # nessuna modifica
    stamp = datetime.date.today().isoformat()
    _git(repo_root, "commit", "-m", f"data: dataset update {stamp}")
    _git(repo_root, "push", remote, branch)
    return True
```

Poi in `cli.py`: aggiungi il flag e la chiamata in coda a `run_pipeline` (dopo
`write_dataset`), controllata da parametro:

```python
# in main(): ap.add_argument("--skip-publish", action="store_true")
# run_pipeline(..., publish=not args.skip_publish)
# in run_pipeline(), nuovo parametro publish=False, dopo write_dataset:
#     if publish:
#         from fantapipe.publish import publish_dataset
#         pushed = publish_dataset(config.ROOT)
#         log.append("publish: pushed" if pushed else "publish: nessuna modifica")
```
(Il default del parametro `publish` in `run_pipeline` è `False` così il test
end-to-end del Task 10 resta senza rete; `main()` passa `True` a meno di
`--skip-publish`.)

- [ ] **Step 5: Esegui tutti i test — PASS**

Run: `.venv\Scripts\python -m pytest tests -v`

- [ ] **Step 6: Prova reale e verifica raw URL**

```powershell
Set-Location D:\railway\fantacalcio\pipeline
$listone = (Get-ChildItem data\listone\*.xlsx | Sort-Object Name | Select-Object -Last 1).FullName
.venv\Scripts\python -m fantapipe.cli --listone $listone
# poi (sostituisci <user>):
curl.exe -s https://raw.githubusercontent.com/<user>/fantacalcio/master/data/dataset.json | Select-Object -First 1
```
Expected: il JSON del dataset servito da GitHub raw.

- [ ] **Step 7: Commit**

```powershell
git add pipeline/fantapipe/publish.py pipeline/tests/test_publish.py pipeline/fantapipe/cli.py pipeline/README.md
git commit -m "feat: dataset publish to GitHub via git push"
git push
```

---

### Task 12: Download automatico del listone (best-effort)

**Files:**
- Create: `pipeline/fantapipe/listone_download.py`
- Create: `pipeline/.env.example`
- Test: `pipeline/tests/test_listone_download.py`
- Modify: `pipeline/fantapipe/cli.py` (`--listone` diventa opzionale)

**Interfaces:**
- Produces: `download_listone(dest_dir: Path, session=None, env: dict | None = None) -> Path | None` —
  scarica l'export quotazioni in `dest_dir/quotazioni_<YYYY-MM-DD>.xlsx`; ritorna
  `None` (con warning su stdout) su qualsiasi fallimento, senza sollevare.
  `env` è il dizionario credenziali (default: `.env` + variabili d'ambiente); i test
  lo passano esplicitamente così un `.env` reale sul PC non li influenza.
  `latest_listone(dest_dir: Path) -> Path | None` — file più recente presente.
- In `cli.py`: se `--listone` è omesso → prova `download_listone`; se `None` →
  usa `latest_listone`; se anche quello è `None` → exit con messaggio chiaro.

- [ ] **Step 1: Scoperta una-tantum degli endpoint reali (manuale)**

Nel browser, loggato su fantacalcio.it: apri DevTools → Network, vai su
Quotazioni → esporta Excel. Annota: (1) URL della POST di login e nomi dei campi
form; (2) URL della GET dell'export Excel. Scrivili nelle costanti `LOGIN_URL`,
`EXPORT_URL`, `LOGIN_FIELDS` in `listone_download.py` allo Step 4. Metti le
credenziali in `pipeline\.env` (`FC_EMAIL=...`, `FC_PASSWORD=...`) — MAI committato
(gitignore già attivo). Crea `pipeline/.env.example` con le due chiavi vuote.

- [ ] **Step 2: Scrivi i test (HTTP mockato)**

`pipeline/tests/test_listone_download.py`:
```python
from fantapipe import listone_download as dl


class FakeResponse:
    def __init__(self, content=b"", status_code=200, ok=True):
        self.content, self.status_code, self.ok = content, status_code, ok


class FakeSession:
    def __init__(self, login_ok=True, export_bytes=b"PK\x03\x04finto-xlsx"):
        self.login_ok, self.export_bytes = login_ok, export_bytes
    def post(self, url, data=None, timeout=None):
        return FakeResponse(ok=self.login_ok,
                            status_code=200 if self.login_ok else 403)
    def get(self, url, timeout=None):
        return FakeResponse(content=self.export_bytes)


CREDS = {"FC_EMAIL": "a@b.it", "FC_PASSWORD": "x"}


def test_download_ok(tmp_path):
    out = dl.download_listone(tmp_path, session=FakeSession(), env=CREDS)
    assert out is not None and out.suffix == ".xlsx"
    assert out.read_bytes().startswith(b"PK")  # firma zip/xlsx


def test_download_fallisce_senza_credenziali(tmp_path):
    assert dl.download_listone(tmp_path, session=FakeSession(), env={}) is None


def test_download_fallisce_su_login_negato(tmp_path):
    assert dl.download_listone(tmp_path, session=FakeSession(login_ok=False),
                               env=CREDS) is None


def test_download_rifiuta_contenuto_non_xlsx(tmp_path):
    s = FakeSession(export_bytes=b"<html>login page</html>")
    assert dl.download_listone(tmp_path, session=s, env=CREDS) is None


def test_latest_listone(tmp_path):
    (tmp_path / "quotazioni_2026-08-01.xlsx").write_bytes(b"PK")
    (tmp_path / "quotazioni_2026-08-10.xlsx").write_bytes(b"PK")
    assert dl.latest_listone(tmp_path).name == "quotazioni_2026-08-10.xlsx"
    assert dl.latest_listone(tmp_path / "vuota") is None
```

- [ ] **Step 3: Esegui — FAIL**

Run: `.venv\Scripts\python -m pytest tests\test_listone_download.py -v`

- [ ] **Step 4: Implementa `fantapipe/listone_download.py`**

```python
import datetime
import os
from pathlib import Path
import requests
from dotenv import load_dotenv

# Valori reali annotati nello Step 1 (aggiorna se il sito cambia)
LOGIN_URL = "https://www.fantacalcio.it/api/v1/User/login"
EXPORT_URL = "https://www.fantacalcio.it/api/v1/Excel/prices/22/1"
LOGIN_FIELDS = ("username", "password")
XLSX_MAGIC = b"PK\x03\x04"


def download_listone(dest_dir: Path, session=None, env: dict | None = None) -> Path | None:
    if env is None:
        load_dotenv(Path(__file__).resolve().parents[1] / ".env")
        env = dict(os.environ)
    email, password = env.get("FC_EMAIL"), env.get("FC_PASSWORD")
    if not email or not password:
        print("WARN: FC_EMAIL/FC_PASSWORD mancanti in pipeline/.env — salto download")
        return None
    s = session or requests.Session()
    try:
        login = s.post(LOGIN_URL,
                       data={LOGIN_FIELDS[0]: email, LOGIN_FIELDS[1]: password},
                       timeout=30)
        if not login.ok:
            print(f"WARN: login fantacalcio.it fallito ({login.status_code})")
            return None
        resp = s.get(EXPORT_URL, timeout=60)
        if not resp.content.startswith(XLSX_MAGIC):
            print("WARN: l'export non è un file xlsx (struttura sito cambiata?)")
            return None
    except requests.RequestException as e:
        print(f"WARN: download listone fallito: {e}")
        return None
    dest_dir.mkdir(parents=True, exist_ok=True)
    out = dest_dir / f"quotazioni_{datetime.date.today().isoformat()}.xlsx"
    out.write_bytes(resp.content)
    return out


def latest_listone(dest_dir: Path) -> Path | None:
    if not dest_dir.exists():
        return None
    files = sorted(dest_dir.glob("quotazioni_*.xlsx"))
    return files[-1] if files else None
```

In `cli.py`: `--listone` diventa `required=False, default=None`; in `main()`:

```python
listone = args.listone
if listone is None:
    from fantapipe.listone_download import download_listone, latest_listone
    listone_dir = config.PIPE_DATA / "listone"
    listone = download_listone(listone_dir) or latest_listone(listone_dir)
    if listone is None:
        sys.exit("Nessun listone: download fallito e nessun file in "
                 f"{listone_dir}. Scarica l'export a mano e riprova con --listone.")
```

- [ ] **Step 5: Esegui tutti i test — PASS**

Run: `.venv\Scripts\python -m pytest tests -v`

- [ ] **Step 6: Prova reale del download**

```powershell
.venv\Scripts\python -c "from pathlib import Path; from fantapipe.listone_download import download_listone; print(download_listone(Path('data/listone')))"
```
Expected: path del file scaricato, oppure WARN esplicativo (accettabile: c'è il
fallback manuale). Se WARN per struttura cambiata: ripeti Step 1 e aggiorna URL.

- [ ] **Step 7: Commit**

```powershell
git add pipeline/fantapipe/listone_download.py pipeline/tests/test_listone_download.py pipeline/fantapipe/cli.py pipeline/.env.example
git commit -m "feat: best-effort listone auto-download with manual fallback"
```

---

### Task 13: Scheduling settimanale + documentazione

**Files:**
- Create: `pipeline/run_weekly.ps1`
- Modify: `pipeline/README.md`

**Interfaces:**
- Consumes: `fantapipe.cli` completo (Task 10-12)
- Produces: task schedulato Windows "FantacalcioPipeline" che esegue la pipeline
  ogni lunedì alle 09:00 e appende l'esito a `pipeline\data\scheduler_log.txt`.

- [ ] **Step 1: Scrivi `pipeline/run_weekly.ps1`**

```powershell
$ErrorActionPreference = "Stop"
$root = "D:\railway\fantacalcio"
$log = "$root\pipeline\data\scheduler_log.txt"
$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
try {
    Set-Location "$root\pipeline"
    & .venv\Scripts\python -m fantapipe.cli
    if ($LASTEXITCODE -ne 0) { throw "pipeline exit code $LASTEXITCODE" }
    Add-Content $log "$stamp OK"
} catch {
    Add-Content $log "$stamp ERRORE: $_"
    exit 1
}
```

- [ ] **Step 2: Prova lo script a mano**

Run: `powershell -ExecutionPolicy Bypass -File D:\railway\fantacalcio\pipeline\run_weekly.ps1`
Expected: riga `... OK` in `pipeline\data\scheduler_log.txt` e dataset pushato
(o "nessuna modifica" nel run_log).

- [ ] **Step 3: Registra il task schedulato**

```powershell
schtasks /Create /TN "FantacalcioPipeline" /SC WEEKLY /D MON /ST 09:00 `
  /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File D:\railway\fantacalcio\pipeline\run_weekly.ps1"
schtasks /Query /TN "FantacalcioPipeline"
```
Expected: task presente. Nota in README: se il PC è spento il lunedì mattina, il
task parte al prossimo avvio solo se si aggiunge l'opzione "Run task as soon as
possible after a scheduled start is missed" (spiegare nel README come attivarla
da Task Scheduler GUI → proprietà del task → Settings).

- [ ] **Step 4: Completa `pipeline/README.md`**

Contenuto: (1) architettura in 5 righe; (2) comandi: run manuale, run con listone
esplicito, test; (3) URL raw del dataset; (4) come gestire i "dubbi" del matching
report con `matching_overrides.csv`; (5) rotazione credenziali `.env`; (6) task
schedulato: nome, orario, log, opzione missed-start.

- [ ] **Step 5: Commit finale**

```powershell
git add pipeline/run_weekly.ps1 pipeline/README.md
git commit -m "chore: weekly scheduler script and pipeline docs"
git push
```

---

## Verifica finale del piano (per l'esecutore)

1. `.venv\Scripts\python -m pytest tests -v` → tutti verdi.
2. Run reale completa (`python -m fantapipe.cli`) → dataset valido, pushato, raw URL raggiungibile.
3. `pipeline\data\matching_report.csv` esaminato: dubbi risolti via overrides o accettati.
4. Il dataset reale contiene giocatori con `traits` non vuoti e stagioni estere con `coeff != 1.0` (verifica campione: un neoacquisto dalla Premier).
