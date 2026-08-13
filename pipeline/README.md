# fantapipe

Pipeline for processing Fantacalcio (Italian fantasy football) data from SofaScore and generating player ratings.

## Architecture

The pipeline orchestrates data ingestion and transformation in four stages: (1) **Download/ingest** Listone (club roster) from Fantacalcio.it export or filesystem; (2) **Fuzzy-match** players across Listone and SofaScore squads to build a unified roster; (3) **Fetch & normalize** player performance data from SofaScore and multi-season foreign league stats; (4) **Compile & publish** an enriched dataset (players + seasonal coefficients + traits) to GitHub as raw JSON. A `matching_report.csv` flags ambiguous matches for manual review and override.

## Running the Pipeline

Manual run (auto-downloads Listone from Fantacalcio.it, falls back to latest file if credentials missing):
```powershell
.venv\Scripts\python -m fantapipe.cli
```

Or with explicit Listone file:
```powershell
.venv\Scripts\python -m fantapipe.cli --listone <path.xlsx>
```

Skip publishing to GitHub:
```powershell
.venv\Scripts\python -m fantapipe.cli --skip-publish
```

Run tests (82 tests):
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

These credentials are used for automated Listone downloads. If not present, the pipeline attempts to use the most recent manually downloaded Listone file in `pipeline/data/listone/`.

**Security note:** The `.env` file is gitignored and never committed. Credentials must be rotated manually by updating the file on the deployment machine.

## Weekly Scheduled Task

A Windows Task Scheduler task named **FantacalcioPipeline** runs the pipeline every Monday at 09:00.

- **Task name:** FantacalcioPipeline
- **Schedule:** Weekly, Monday, 09:00
- **Script:** `D:\railway\fantacalcio\pipeline\run_weekly.ps1`
- **Log output:** `pipeline\data\scheduler_log.txt` (one line per run: timestamp + OK or ERRORE)

If the machine is powered off on Monday morning and misses the scheduled start, the task will not automatically run later. To enable missed-start recovery:
1. Open Task Scheduler GUI
2. Right-click "FantacalcioPipeline" → Properties
3. Go to Settings tab
4. Check "Run task as soon as possible after a scheduled start is missed"
5. Click OK

**Expected behavior during setup:** If `.env` credentials or a Listone file are missing, the scheduled task will log an ERRORE line with "Nessun listone" message. This is normal during initial setup — once credentials and a Listone file are in place, the task will run successfully.
