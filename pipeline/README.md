# fantapipe

Pipeline for processing Fantacalcio (Italian fantasy football) data from SofaScore and generating player ratings.

## Architecture

The pipeline orchestrates data ingestion and transformation in four stages: (1) **Download/ingest** Listone — primary source: PDF Gazzetta "fantacampionato" (public, no credentials); legacy: Fantacalcio.it xlsx export or filesystem; (2) **Fuzzy-match** players across Listone and SofaScore squads to build a unified roster; (3) **Fetch & normalize** player performance data from SofaScore and multi-season foreign league stats; (4) **Compile & publish** an enriched dataset (players + seasonal coefficients + traits + optional coaches) to GitHub as raw JSON. A `matching_report.csv` flags ambiguous matches for manual review and override.

### Listone Gazzetta (PDF)

`fantapipe/listone_gazzetta.py` parses the two-column PDF (sections Portieri/Difensori/Centrocampisti/Attaccanti/Allenatori). Since the PDF has no numeric ids and no FVM: ids are **synthesized** as a stable hash of (ruolo, nome, squadra) — they stay identical across weekly runs until a player changes team — and `qta`=`fvm`=cost in fantamilioni. Identical twin entries (the Oyono twins at Frosinone) get disambiguated as `"OYONO"`/`"OYONO (2)"` in PDF order. Coaches land in the dataset under the **optional top-level key `allenatori`** (`[{nome, squadra, qta}]`, additive — `schemaVersion` stays 1); leagues that don't use coaches simply ignore it in the app.

## Running the Pipeline

Manual run — auto-download order: (1) PDF Gazzetta from `GAZZETTA_URL` (public, no credentials; the `?v=` query param is a cache-buster — update it in `fantapipe/listone_download.py` if Gazzetta publishes a new listone); (2) Fantacalcio.it xlsx (legacy, needs `.env` credentials; `LOGIN_URL` is an unverified best-guess); (3) most recent file already in `pipeline/data/listone/`:
```powershell
.venv\Scripts\python -m fantapipe.cli
```

Or with explicit Listone file (`.pdf` = Gazzetta parser, anything else = xlsx loader):
```powershell
.venv\Scripts\python -m fantapipe.cli --listone <path.pdf|path.xlsx>
```

Skip publishing to GitHub:
```powershell
.venv\Scripts\python -m fantapipe.cli --skip-publish
```

Run tests (117 tests):
```powershell
.venv\Scripts\python -m pytest tests -v
```

## Dataset URL

The generated dataset is published to GitHub (repo `Cilluzzo79/fantacalcio`, branch `master`) and is consumable via raw URL:

```
https://raw.githubusercontent.com/Cilluzzo79/fantacalcio/master/data/dataset.json
```

**Note:** `data/dataset.json` does not yet exist in the repo (the first real pipeline run is pending), so the URL above currently responds with 404 — this is expected. It will become available after the first real run that executes `fantapipe.cli` with `--skip-publish` omitted (publishing enabled).

## Matching Doubts & Overrides

When player names or IDs between Listone and SofaScore squads are ambiguous, the pipeline generates a `matching_report.csv` in `pipeline/data/matching_report.csv`. This report flags uncertain matches with their proposed sofa_id and a match_status of "dubbio" (doubt) or "nessuno" (no match found).

To manually correct uncertain matches, create or edit `pipeline/data/matching_overrides.csv` with exactly two columns: `listone_id,sofa_id`. Each row is a FORCED mapping that overrides fuzzy matching results entirely.

**Workflow:**
1. Review `pipeline/data/matching_report.csv` for rows with `match_status` = "dubbio" or "nessuno"
2. For each incorrect match, find the correct SofaScore player ID using:
   ```powershell
   sofascore-pp-cli sofascore-search --q "<player_name>" --agent
   ```
3. Add a row to `pipeline/data/matching_overrides.csv` with the corrected sofa_id (the override wins over any fuzzy result)
4. Re-run the pipeline — overridden matches will have `match_status` = "override"

**Example override file:**
```
listone_id,sofa_id
42,1234567
89,2345678
125,3456789
```

## Credentials & Environment

Create a `.env` file in `pipeline/` (copy from `.env.example`) with:
- `FC_EMAIL`: Email for Fantacalcio.it account
- `FC_PASSWORD`: Password for Fantacalcio.it account

These credentials are **optional** since the Gazzetta PDF became the primary source: they only serve the legacy Fantacalcio.it xlsx download. If not present, the pipeline falls back to the most recent Listone file in `pipeline/data/listone/`.

**Security note:** The `.env` file is gitignored and never committed. Credentials must be rotated manually by updating the file on the deployment machine.

## Weekly Scheduled Task

A Windows Task Scheduler task named **FantacalcioPipeline** runs the pipeline every Monday at 09:00.

- **Task name:** FantacalcioPipeline
- **Schedule:** Weekly, Monday, 09:00
- **Script:** `D:\railway\fantacalcio\pipeline\run_weekly.ps1`
- **Log output:** `pipeline\data\scheduler_log.txt` (one line per run: timestamp + OK, or timestamp + "ERRORE: pipeline exit code 1" on failure — that line alone has no detail; the full stdout/stderr of the run is captured separately in `pipeline\data\last_run_output.txt`, overwritten every run)

If the machine is powered off on Monday morning and misses the scheduled start, the task will not automatically run later. To enable missed-start recovery:
1. Open Task Scheduler GUI
2. Right-click "FantacalcioPipeline" → Properties
3. Go to Settings tab
4. Check "Run task as soon as possible after a scheduled start is missed"
5. Click OK

**Expected behavior during setup:** If `.env` credentials or a Listone file are missing, the scheduled task will log an ERRORE line with "Nessun listone" message. This is normal during initial setup — once credentials and a Listone file are in place, the task will run successfully.

## Checklist prima run reale

Prima di affidarsi a una run reale (specialmente la prima, o dopo che il sito Fantacalcio.it cambia):

1. **Verifica che `GAZZETTA_URL`** in `fantapipe/listone_download.py` punti ancora al listone corrente (il `?v=` è un cache-buster che Gazzetta aggiorna a ogni ripubblicazione). In alternativa, scarica il PDF a mano e salvalo in `pipeline/data/listone/` come `listone_gazzetta_<data>.pdf`.
2. **Prima run con `--skip-publish`** per controllare l'output senza pubblicare un dataset potenzialmente sbagliato.
3. **Rivedi `matching_report.csv`** (righe `dubbio` e `duplicato`) e confronta le squadre del listone con `TEAM_ALIASES` in `fantapipe/config.py` — squadre non mappate finiscono con `match_status="nessuno"` per tutti i loro giocatori.
4. **Verifica le statistiche di un PORTIERE reale** nel dataset generato: controlla che `gol subiti` (season `golSubiti`) sia presente e non `null` per le sue stagioni più recenti.
5. **Run con publish** e verifica che il raw URL (`https://raw.githubusercontent.com/Cilluzzo79/fantacalcio/master/data/dataset.json`) risponda con il dataset aggiornato.
