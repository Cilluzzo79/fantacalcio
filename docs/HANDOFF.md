# HANDOFF — Fantacalcio Asta

> Ultimo aggiornamento: 2026-08-14 · Repo pubblico: https://github.com/Cilluzzo79/fantacalcio

## 1. Cos'è il progetto

Assistente per le aste del fantacalcio Serie A (modalità **Classic**), uso personale (utente: Mauro, Android). Due componenti:

1. **Pipeline dati Python** (`pipeline/`) — unisce statistiche SofaScore e quotazioni del listone Fantacalcio.it, calcola le valutazioni e pubblica `data/dataset.json` su GitHub (servito via raw URL).
2. **App mobile Expo/React Native** (`app/`) — consuma il dataset; preparazione pre-asta + assistente live durante l'asta a chiamata (solo l'utente registra gli acquisti; 100% offline durante l'asta; fino a 5 leghe; modalità riparazione per gennaio).

**Spec approvata**: `docs/superpowers/specs/2026-08-12-fantacalcio-asta-design.md` — è il documento che governa. Metodo di lavoro: skill superpowers (`brainstorming` → `writing-plans` → `subagent-driven-development` con review indipendente per ogni task + final review).

## 2. Stato: cosa è FATTO

### Piano 1 — Pipeline dati ✅ (completo, `docs/superpowers/plans/2026-08-12-pipeline-dati.md`)
- Package `fantapipe` in `pipeline/` (venv: `pipeline\.venv`), **117 test pytest verdi**.
- Flusso: listone Excel → matching fuzzy con rose SofaScore (ambiguità→"dubbio", duplicati sofaId→demote, report + overrides) → carriere multi-campionato con selezione league-first per anno (coppe/nazionali/giovanili escluse) e cache per giocatore → traits (rigorista, para-rigori...) → proiezioni (recency 0.5/0.3/0.2, coefficienti di lega) → fasce+affidabilità (−15 se match "dubbio") → `dataset.json` validato → publish su GitHub (gated: salta se match<70% o carriere<60%; commit con pathspec) → scheduler.
- **Contratto `dataset.json`**: nell'header del piano. Il dataset NON contiene prezzi in crediti (solo `valueScore`; i prezzi li calcola l'app per lega).
- Scheduler Windows: task "FantacalcioPipeline", lunedì 09:00, `pipeline/run_weekly.ps1` (passa `--max-age-days 6`), log in `pipeline\data\scheduler_log.txt` + `last_run_output.txt`.
- Comandi: da `pipeline\`: `.venv\Scripts\python -m pytest tests -v` · run: `.venv\Scripts\python -m fantapipe.cli [--listone <xlsx>] [--skip-publish]`.

### Estensione CLI SofaScore ✅ (fuori piano, indispensabile)
- Il CLI `C:\Users\Mauro\printing-press\library\sofascore\sofascore-pp-cli.exe` NON aveva un endpoint per le statistiche stagionali per giocatore (verificato esaustivamente: 15 endpoint totali). È generato da sorgente Go **nella stessa cartella** (NON è un repo git).
- Aggiunto il comando `player statistics get-player-season-statistics <playerId> <utId> <seasonId>` (endpoint `/player/{id}/unique-tournament/{ut}/season/{s}/statistics/overall`, ~115 chiavi). Envelope: `{"meta":..., "results": {"statistics": {...}, "team": {...}}}`.
- Backup `.bak-20260813` dei file toccati e dell'exe; patch documentata in `.printing-press-patches.json` (id `player-season-statistics-endpoint`). **Pendente: aprire issue upstream su `mvanhorn/cli-printing-press`.**
- Permesso: `C:\Users\Mauro\printing-press` è in `additionalDirectories` di `.claude/settings.local.json` (locale, non committato — da ricreare se sparisce).

### Piano 2a — Fondamenta app ✅ (completo, `docs/superpowers/plans/2026-08-13-app-fondamenta.md`)
- `app/` = Expo **SDK 57** + TypeScript strict + expo-router. **55 test jest / 10 suite verdi**, typecheck pulito, `npx expo export --platform android` ok.
- `src/domain/` (puro, zero import RN): `types.ts` (contratto dataset, verificato campo-per-campo vs pipeline), `prices.ts` (replacement/VORP → prezzo equo per lega), `auction.ts` (acquisti validati, undo, edit che preserva id/ts, modalità riparazione, **opts.force** per registrare comunque), `live.ts` (inflazione implicita freeMoney/unsoldExtra, scarsità, bidAdvice con max tuo e degli avversari).
- `src/services/datasetService.ts`: refresh da GitHub raw + cache locale + import, Deps iniettabili.
- `src/store/`: `leagues` (max 5, riparazione, myTeamIndex validato), `auctions` (persist crash-safe, round-trip testato, getAuction con identity stabile), `dataset` (boot resiliente, **niente auto-refresh se un'asta ha acquisti**).
- UI minima 2 tab (Lega/Listone) — placeholder funzionante, il design vero è il Piano 2b.
- Comandi: da `app\`: `npm test -- --watchAll=false` · `npm run typecheck` · `npx expo start`.
- ⚠️ Quirk SDK 57: router root = `app/src/app/` (non `app/app/`); expo-file-system importato da `expo-file-system/legacy`; jest testMatch ristretto a `*.test.ts`.

## 3. Cosa MANCA (in ordine)

### A. Prima run reale ✅ PUBBLICATA (2026-08-14)
Il **raw URL è vivo** (HTTP 200): dataset da listone Gazzetta con 577 giocatori (479 con stagioni reali, matching 498/577, carriere 487/498=98%), 20 allenatori. Checklist completata: matching_report rivisto (11 dubbi attesi, gemelli OYONO ok), portiere verificato (golSubiti/cleanSheet/rigParati presenti), publish diretto via `publish_dataset()` (la run con publish integrata era ri-bloccata dal challenge — v. gotcha §5).

**Refinement pendente (non bloccante)**: override per i ~78 non matchati, tra cui big (LUKAKU, DOVBYK, OPENDA, YILDIZ, GOSENS, ANGELINO, BELOTTI, BENNACER, CASTRO...) — proposta da costruire con `sofascore-search` quando il challenge decade, poi revisione utente, poi re-run+publish (o si aggiorna col job settimanale).

### B. Fix scheduler ✅ (2026-08-14)
`pipeline/run_weekly.ps1`: il merge stdout/stderr ora lo fa `cmd /c` (PowerShell 5.1 con EAP=Stop trasformava stderr benigno in falso "ERRORE" — riprodotto empiricamente prima e dopo il fix, inclusa la propagazione dei veri exit code ≠ 0).

### C. Piano 2b — UI completa (da scrivere con writing-plans)
5 schermate col design curato (skill frontend-design, tema scuro sportivo): Lega (+riparazione), Listone, Strategia (piano budget + target), Asta live (il cuore: bidAdvice, registrazione 2-3 tap, rose avversarie, undo), Riepilogo. Poi APK (EAS build o gradle).
**Note vincolanti dal triage della final review 2a**: la schermata riparazione deve validare l'over-allocazione del rosterIniziale; il refresh dataset deve esporre un "reason" per l'error surface; riscrivere gli input della Home (bug `parseInt("0")||8`, floor crediti dimensionalmente errato); il Listone 2b deve usare `computeLive` (i prezzi base sono sbagliati in riparazione); sanity: Σ prezzi ≈ monte solo sui giocatori vorp>0.
**Nota vincolante 2026-08-14 (richiesta utente)**: gli **allenatori sono opzionali per lega** — il dataset ora può contenere la chiave top-level `allenatori` (`[{nome, squadra, qta}]`); la lega deve avere un toggle "usa allenatori" (default off) e solo se attivo l'app mostra/gestisce lo slot allenatore (asta, budget, rosa). `parseDataset` dell'app ignora già le chiavi extra: nessuna migrazione necessaria.

### D. Varie minori
- Issue upstream per il CLI printing-press (vedi §2).
- I "minor (deferred)" di entrambi i piani sono nei ledger/nelle review; nessuno bloccante.

## 4. Come RIPARTIRE da una nuova finestra di contesto

1. **Leggi questo file**, poi la spec (`docs/superpowers/specs/...`) se serve il contesto di prodotto.
2. **Memoria persistente**: `C:\Users\Mauro\.claude\projects\d--railway-fantacalcio\memory\` (MEMORY.md indicizza `fantacalcio-pipeline` e `sofascore-pp-cli-esteso`).
3. **Verifica lo stato reale** (mai fidarsi dei ricordi):
   ```powershell
   git -C D:\railway\fantacalcio log --oneline -5     # HEAD atteso: 667707d o successivo
   git -C D:\railway\fantacalcio status --short
   # pipeline: cd D:\railway\fantacalcio\pipeline ; .venv\Scripts\python -m pytest tests -q   (95 verdi)
   # app:      cd D:\railway\fantacalcio\app ; npm test -- --watchAll=false                    (55 verdi)
   ```
4. **Ledger SDD**: il Piano 1 ha ancora il suo workspace (`.superpowers/sdd/2026-08-12-pipeline-dati/progress.md` — contiene il parcheggiato §3B); il workspace del 2a è stato rimosso (record = storia git).
5. **Processo**: nuove feature → `superpowers:brainstorming` (se serve design) → `superpowers:writing-plans` → `superpowers:subagent-driven-development` (branch master ok, consenso già dato per questo repo). Il Piano 2b riparte da writing-plans usando la spec §6 + le note §3C.
6. **Priorità suggerita**: sbloccare §3A (serve l'utente) → §3B (un ok) → scrivere ed eseguire il Piano 2b.

## 5. Gotcha noti
- API SofaScore, DUE modi di fallire con 403 (imparati il 2026-08-14):
  1. **`403 Forbidden` su tutto, subito** → quasi certamente c'è la **VPN CyberGhost attiva** (esce da IP datacenter CDN77 che SofaScore blocca a prescindere). Controllare `Get-NetAdapter` per `CyberGhost-WireGuard-1`: la VPN va spenta prima di ogni run (occhio al job del lunedì 09:00!). Header custom eventuali in `C:\Users\Mauro\.config\sofascore-pp-cli\config.toml` (`[headers]`).
  2. **`403 "challenge"` a metà run** → protezione anti-bot da volume: decade da solo in ~1-2 ore. Lo spacing è già 1s (`CALL_SPACING_S`); le carriere già prese sono in cache (`pipeline\cache\players\`), quindi basta rilanciare e si converge. Se serve solo pubblicare un dataset già scritto e validato, usare direttamente `publish_dataset()` senza rifare la pipeline (zero chiamate API).
- Il listone Gazzetta è un PDF a due colonne: il parser (`listone_gazzetta.py`) legge colonna sinistra poi destra; gli id giocatore sono hash stabili di (ruolo, nome, squadra) — un trasferimento cambia l'id e invalida l'eventuale riga in `matching_overrides.csv`.
- Il repo è PUBBLICO: mai committare `.env`, credenziali, `pipeline/data/`, `.superpowers/` (già in .gitignore).
- `generatedAt` si confronta come stringa ISO (ok finché la pipeline emette UTC `isoformat(timespec="seconds")`).
- GitHub ha avuto 500 transitori sul push il 2026-08-13: se il push fallisce con "Internal Server Error", riprovare dopo qualche minuto.
- Il template Expo ha lasciato `app/.claude/settings.json` e uno script `reset-project` orfano: innocui.
