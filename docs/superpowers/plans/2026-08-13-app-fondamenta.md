# App Fondamenta (Piano 2a) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fondamenta dell'app mobile (Expo/React Native + TypeScript): logica di dominio pura e testata (prezzi per lega, stato asta, aggiustamenti live), data layer per `dataset.json`, store multi-lega persistente, UI minima navigabile. Le 5 schermate con design curato arrivano nel Piano 2b.

**Architecture:** Dominio puro in `src/domain/` (zero dipendenze React Native, testato con Jest), servizi con side-effect in `src/services/`, stato in `src/store/` (Zustand + persist su AsyncStorage, salvataggio a ogni azione), routing file-based con expo-router. Il dataset (~1-2 MB JSON) vive su file via expo-file-system e in memoria a runtime; i prezzi in crediti sono SEMPRE derivati per-lega dal `valueScore` (mai salvati nel dataset).

**Tech Stack:** Expo SDK (create-expo-app@latest, template default = TypeScript + expo-router), Zustand ^5, @react-native-async-storage/async-storage, expo-file-system, expo-document-picker, jest + jest-expo.

**Spec:** `docs/superpowers/specs/2026-08-12-fantacalcio-asta-design.md` (§3, §5 Fase B/C, §6). Contratto dataset: header di `docs/superpowers/plans/2026-08-12-pipeline-dati.md`.

## Global Constraints

- App in `D:\railway\fantacalcio\app`. Comandi npm/npx eseguiti da quella directory (PowerShell).
- TypeScript `strict: true` (default del template). `npx tsc --noEmit` DEVE essere pulito a fine di ogni task.
- Test: `npm test -- --watchAll=false` (jest-expo). Il dominio (`src/domain/`) non importa NULLA da react-native/expo.
- Massimo **5 leghe** (`MAX_LEAGUES = 5`); creazione della sesta → errore.
- Ruoli Classic `"P" | "D" | "C" | "A"`; rosa default `{P: 3, D: 8, C: 8, A: 6}`.
- Dataset URL: `https://raw.githubusercontent.com/Cilluzzo79/fantacalcio/master/data/dataset.json`.
- Prezzo minimo di ogni giocatore: 1 credito. La somma dei prezzi equi di lega ≈ monte crediti della lega.
- Persistenza: ogni azione di asta è salvata subito (persist middleware) — crash-safe.
- Commit frequenti, messaggi in inglese con prefissi feat:/test:/chore:.
- Il repo è pubblico: mai committare chiavi/segreti; `node_modules/` già in .gitignore radice.

## Contratto dati condiviso (fissato qui, usato da tutti i task)

```ts
// src/domain/types.ts — Task 2 lo crea esattamente così
export type Ruolo = "P" | "D" | "C" | "A";
export type Fascia = "top" | "semitop" | "titolare" | "scommessa" | "lowcost";

export interface SeasonRow {
  season: string; torneo: string; coeff: number; pg: number; min: number;
  gol: number; assist: number; amm: number; esp: number; rating: number | null;
  rigCalc: number; rigSegn: number;
  golSubiti: number | null; cleanSheet: number | null; rigParati: number | null;
}

export interface Player {
  id: number; sofaId: number | null; nome: string; ruolo: Ruolo; squadra: string;
  qta: number; fvm: number; fascia: Fascia; valueScore: number; fmProj: number;
  votoProj: number; startsShare: number; affidabilita: number;
  traits: string[]; note: string[]; seasons: SeasonRow[];
}

export interface Dataset {
  schemaVersion: 1; generatedAt: string; season: string; quotazioniFile: string;
  players: Player[];
}

export interface TeamConfig {
  id: string;            // uuid locale
  nome: string;
  crediti: number;       // in modalità riparazione: crediti RESIDUI
  rosterIniziale: { playerId: number; prezzo: number }[]; // vuoto per asta estiva
}

export interface League {
  id: string; nome: string;
  slots: Record<Ruolo, number>;    // default {P:3,D:8,C:8,A:6}
  teams: TeamConfig[];             // teams[myTeamIndex] è l'utente
  myTeamIndex: number;
  createdAt: string;               // ISO
}

export interface Purchase {
  id: string;            // uuid evento
  playerId: number; teamId: string; prezzo: number; ts: string;
}

export interface AuctionState { leagueId: string; purchases: Purchase[]; }
```

---

### Task 1: Scaffold Expo + Jest

**Files:**
- Create: `app/` (via create-expo-app), `app/src/domain/__tests__/sanity.test.ts`
- Modify: `app/package.json` (script test e typecheck)

**Interfaces:**
- Produces: progetto Expo TypeScript con expo-router funzionante, `npm test` (jest-expo) e `npm run typecheck` (`tsc --noEmit`) verdi.

- [ ] **Step 1: Genera il progetto**

```powershell
Set-Location D:\railway\fantacalcio
npx create-expo-app@latest app --template default
Set-Location app
npm run reset-project   # sposta gli screen di esempio in app-example/
Remove-Item -Recurse -Force app-example
```
(Se il template non offre `reset-project`, elimina a mano gli screen di esempio lasciando `app/_layout.tsx` e `app/index.tsx` minimi.)

- [ ] **Step 2: Aggiungi Jest e gli script**

```powershell
npx expo install jest-expo jest @types/jest
```
In `app/package.json` aggiungi:
```json
"scripts": { "test": "jest", "typecheck": "tsc --noEmit" },
"jest": { "preset": "jest-expo", "testPathIgnorePatterns": ["/node_modules/"] }
```
(mantieni gli script esistenti del template; aggiungi soltanto.)

- [ ] **Step 3: Test sanity**

`app/src/domain/__tests__/sanity.test.ts`:
```ts
test("jest funziona", () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 4: Verifica**

Run: `npm test -- --watchAll=false` → PASS (1 test). `npm run typecheck` → exit 0.

- [ ] **Step 5: Commit**

```powershell
Set-Location D:\railway\fantacalcio
git add app
git commit -m "feat: scaffold expo app with jest and typecheck"
```

---

### Task 2: Tipi di dominio + parsing/validazione dataset

**Files:**
- Create: `app/src/domain/types.ts` (ESATTAMENTE il blocco "Contratto dati condiviso" sopra)
- Create: `app/src/domain/ids.ts`
- Create: `app/src/domain/dataset.ts`
- Create: `app/src/domain/__tests__/fixtures.ts`
- Test: `app/src/domain/__tests__/dataset.test.ts`

`app/src/domain/ids.ts` (usato da auction.ts e dagli store; vive nel dominio così
il dominio non dipende mai dagli store):
```ts
export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
```

**Interfaces:**
- Produces:
  - tutti i tipi di `types.ts` (vedi contratto sopra)
  - `parseDataset(json: unknown): Dataset` — valida e restituisce; lancia `DatasetError` con messaggio esplicativo su qualsiasi violazione
  - `class DatasetError extends Error`
  - fixture `miniDataset(): Dataset` (8 giocatori: 2 per ruolo, valueScore noti) riusata dai Task 3-9

- [ ] **Step 1: Scrivi fixture e test**

`app/src/domain/__tests__/fixtures.ts`:
```ts
import type { Dataset, Player, Ruolo } from "../types";

let nextId = 1;
export function mkPlayer(p: Partial<Player> & { ruolo: Ruolo }): Player {
  return {
    id: nextId++, sofaId: 1000 + nextId, nome: `Player${nextId}`, squadra: "Inter",
    qta: 10, fvm: 50, fascia: "titolare", valueScore: 20, fmProj: 6.5,
    votoProj: 6.1, startsShare: 0.8, affidabilita: 90, traits: [], note: [],
    seasons: [], ...p,
  };
}

export function miniDataset(): Dataset {
  nextId = 1;
  return {
    schemaVersion: 1, generatedAt: "2026-08-13T07:00:00+00:00",
    season: "2026-27", quotazioniFile: "quot.xlsx",
    players: [
      mkPlayer({ ruolo: "P", nome: "PortiereTop", valueScore: 30 }),
      mkPlayer({ ruolo: "P", nome: "PortiereLow", valueScore: 5, fascia: "lowcost" }),
      mkPlayer({ ruolo: "D", nome: "DifTop", valueScore: 40, fascia: "top" }),
      mkPlayer({ ruolo: "D", nome: "DifLow", valueScore: 5, fascia: "lowcost" }),
      mkPlayer({ ruolo: "C", nome: "CenTop", valueScore: 50, fascia: "top", traits: ["assistman"] }),
      mkPlayer({ ruolo: "C", nome: "CenLow", valueScore: 5, fascia: "lowcost" }),
      mkPlayer({ ruolo: "A", nome: "AttTop", valueScore: 80, fascia: "top", traits: ["rigorista"] }),
      mkPlayer({ ruolo: "A", nome: "AttLow", valueScore: 10, fascia: "scommessa" }),
    ],
  };
}
```

`app/src/domain/__tests__/dataset.test.ts`:
```ts
import { parseDataset, DatasetError } from "../dataset";
import { miniDataset } from "./fixtures";

test("parseDataset accetta un dataset valido", () => {
  const ds = parseDataset(JSON.parse(JSON.stringify(miniDataset())));
  expect(ds.players).toHaveLength(8);
  expect(ds.season).toBe("2026-27");
});

test("rifiuta schemaVersion diversa da 1", () => {
  const raw = { ...miniDataset(), schemaVersion: 2 };
  expect(() => parseDataset(raw)).toThrow(DatasetError);
  expect(() => parseDataset(raw)).toThrow(/schemaVersion/);
});

test("rifiuta players mancanti o vuoti", () => {
  expect(() => parseDataset({ ...miniDataset(), players: [] })).toThrow(/players/);
  expect(() => parseDataset({ schemaVersion: 1 })).toThrow(DatasetError);
});

test("rifiuta un giocatore con ruolo non valido", () => {
  const raw = miniDataset() as any;
  raw.players[0].ruolo = "X";
  expect(() => parseDataset(raw)).toThrow(/ruolo/);
});

test("rifiuta un giocatore senza campi obbligatori", () => {
  const raw = miniDataset() as any;
  delete raw.players[2].valueScore;
  expect(() => parseDataset(raw)).toThrow(/valueScore/);
});

test("rifiuta non-oggetti", () => {
  expect(() => parseDataset("ciao")).toThrow(DatasetError);
  expect(() => parseDataset(null)).toThrow(DatasetError);
});
```

- [ ] **Step 2: Esegui — FAIL (modulo inesistente)**

Run: `npm test -- --watchAll=false dataset`

- [ ] **Step 3: Implementa `src/domain/types.ts` (contratto verbatim) e `src/domain/dataset.ts`**

`app/src/domain/dataset.ts`:
```ts
import type { Dataset, Player } from "./types";

export class DatasetError extends Error {}

const RUOLI = ["P", "D", "C", "A"] as const;
const FASCE = ["top", "semitop", "titolare", "scommessa", "lowcost"] as const;

const REQUIRED_NUM: (keyof Player)[] = ["id", "qta", "fvm", "valueScore",
  "fmProj", "votoProj", "startsShare", "affidabilita"];
const REQUIRED_STR: (keyof Player)[] = ["nome", "squadra"];

function fail(msg: string): never { throw new DatasetError(msg); }

function checkPlayer(p: any, i: number): void {
  if (typeof p !== "object" || p === null) fail(`players[${i}] non è un oggetto`);
  for (const k of REQUIRED_NUM) {
    if (typeof p[k] !== "number") fail(`players[${i}].${String(k)} mancante o non numerico (${p.nome ?? "?"})`);
  }
  for (const k of REQUIRED_STR) {
    if (typeof p[k] !== "string") fail(`players[${i}].${String(k)} mancante`);
  }
  if (!RUOLI.includes(p.ruolo)) fail(`players[${i}]: ruolo non valido "${p.ruolo}"`);
  if (!FASCE.includes(p.fascia)) fail(`players[${i}]: fascia non valida "${p.fascia}"`);
  if (p.sofaId !== null && typeof p.sofaId !== "number") fail(`players[${i}].sofaId non valido`);
  if (!Array.isArray(p.traits) || !Array.isArray(p.note) || !Array.isArray(p.seasons))
    fail(`players[${i}]: traits/note/seasons devono essere array`);
}

export function parseDataset(json: unknown): Dataset {
  if (typeof json !== "object" || json === null) fail("dataset non è un oggetto");
  const d = json as any;
  if (d.schemaVersion !== 1) fail(`schemaVersion attesa 1, trovata ${d.schemaVersion}`);
  if (typeof d.generatedAt !== "string" || typeof d.season !== "string")
    fail("generatedAt/season mancanti");
  if (!Array.isArray(d.players) || d.players.length === 0) fail("players mancanti o vuoti");
  d.players.forEach(checkPlayer);
  return d as Dataset;
}
```

- [ ] **Step 4: Esegui — PASS (6 test) + typecheck pulito**

Run: `npm test -- --watchAll=false dataset` e `npm run typecheck`

- [ ] **Step 5: Commit**

```powershell
git add app/src/domain
git commit -m "feat: domain types and dataset contract validation"
```

---

### Task 3: Prezzi per lega (Fase B)

**Files:**
- Create: `app/src/domain/prices.ts`
- Test: `app/src/domain/__tests__/prices.test.ts`

**Interfaces:**
- Consumes: `types.ts`, fixture `miniDataset`
- Produces:
  - `interface LeagueParams { teams: number; creditiPerTeam: number; slots: Record<Ruolo, number> }`
  - `computeLeaguePrices(players: Player[], params: LeagueParams): Map<number, number>` — playerId → prezzo equo intero ≥ 1
  - `replacementLevels(players: Player[], params: LeagueParams): Record<Ruolo, number>`

Formule (dalla spec §5 Fase B):
- slot totali per ruolo `S_r = teams × slots[r]`; replacement_r = `valueScore` del primo giocatore NON titolare (rank S_r+1, indice `S_r` ordinando desc); se il ruolo ha ≤ S_r giocatori, replacement = valueScore dell'ULTIMO giocatore del ruolo (il marginale costa 1 credito → suo vorp = 0); 0 se il ruolo è vuoto.
- `vorp_i = max(0, valueScore_i − replacement_{ruolo_i})`
- monte = `teams × creditiPerTeam`; minSpend = `teams × Σ_r slots[r]`; extra = monte − minSpend
- `prezzo_i = 1 + round(extra × vorp_i / Σ vorp)` (se Σ vorp = 0 → tutti a 1)

- [ ] **Step 1: Scrivi i test**

`app/src/domain/__tests__/prices.test.ts`:
```ts
import { computeLeaguePrices, replacementLevels } from "../prices";
import { miniDataset, mkPlayer } from "./fixtures";

const PARAMS = { teams: 2, creditiPerTeam: 100, slots: { P: 1, D: 1, C: 1, A: 1 } };
// monte=200, minSpend=2*4=8, extra=192

test("replacement è il valueScore dell'ultimo titolare acquistabile", () => {
  const repl = replacementLevels(miniDataset().players, PARAMS);
  // 2 slot totali per ruolo, 2 giocatori per ruolo -> replacement = il peggiore
  expect(repl.A).toBe(10);
  expect(repl.P).toBe(5);
});

test("la somma dei prezzi approssima il monte crediti", () => {
  const prices = computeLeaguePrices(miniDataset().players, PARAMS);
  const sum = [...prices.values()].reduce((a, b) => a + b, 0);
  // minSpend 8 + extra distribuito con arrotondamenti: entro ±players dal monte
  expect(Math.abs(sum - 200)).toBeLessThanOrEqual(8);
});

test("ogni prezzo è >= 1 e i migliori costano di più", () => {
  const ds = miniDataset();
  const prices = computeLeaguePrices(ds.players, PARAMS);
  for (const v of prices.values()) expect(v).toBeGreaterThanOrEqual(1);
  const att = ds.players.filter(p => p.ruolo === "A");
  expect(prices.get(att[0].id)!).toBeGreaterThan(prices.get(att[1].id)!);
});

test("vorp zero per chi è sotto il replacement", () => {
  const players = [
    mkPlayer({ ruolo: "A", valueScore: 50 }),
    mkPlayer({ ruolo: "A", valueScore: 40 }),
    mkPlayer({ ruolo: "A", valueScore: 30 }), // sotto replacement con S_A=2
    mkPlayer({ ruolo: "P", valueScore: 10 }),
    mkPlayer({ ruolo: "D", valueScore: 10 }),
    mkPlayer({ ruolo: "C", valueScore: 10 }),
  ];
  const prices = computeLeaguePrices(players, PARAMS);
  expect(prices.get(players[2].id)).toBe(1); // vorp 0 -> prezzo 1
});

test("scala con i parametri lega: più crediti, prezzi più alti", () => {
  const ds = miniDataset();
  const ricca = computeLeaguePrices(ds.players, { ...PARAMS, creditiPerTeam: 500 });
  const povera = computeLeaguePrices(ds.players, PARAMS);
  const top = ds.players.find(p => p.nome === "AttTop")!;
  expect(ricca.get(top.id)!).toBeGreaterThan(povera.get(top.id)!);
});

test("tutti vorp zero -> tutti a 1", () => {
  const players = [
    mkPlayer({ ruolo: "A", valueScore: 0 }), mkPlayer({ ruolo: "P", valueScore: 0 }),
    mkPlayer({ ruolo: "D", valueScore: 0 }), mkPlayer({ ruolo: "C", valueScore: 0 }),
  ];
  const prices = computeLeaguePrices(players, PARAMS);
  for (const v of prices.values()) expect(v).toBe(1);
});
```

- [ ] **Step 2: Esegui — FAIL**

Run: `npm test -- --watchAll=false prices`

- [ ] **Step 3: Implementa `src/domain/prices.ts`**

```ts
import type { Player, Ruolo } from "./types";

export interface LeagueParams {
  teams: number;
  creditiPerTeam: number;
  slots: Record<Ruolo, number>;
}

const RUOLI: Ruolo[] = ["P", "D", "C", "A"];

export function replacementLevels(players: Player[], params: LeagueParams): Record<Ruolo, number> {
  const repl = {} as Record<Ruolo, number>;
  for (const r of RUOLI) {
    const sorted = players.filter(p => p.ruolo === r)
      .map(p => p.valueScore).sort((a, b) => b - a);
    const sTot = params.teams * params.slots[r];
    repl[r] = sorted.length === 0 ? 0
      : sorted.length > sTot ? sorted[sTot]
      : sorted[sorted.length - 1];
  }
  return repl;
}

export function computeLeaguePrices(players: Player[], params: LeagueParams): Map<number, number> {
  const repl = replacementLevels(players, params);
  const vorp = new Map<number, number>();
  let sumVorp = 0;
  for (const p of players) {
    const v = Math.max(0, p.valueScore - repl[p.ruolo]);
    vorp.set(p.id, v);
    sumVorp += v;
  }
  const monte = params.teams * params.creditiPerTeam;
  const minSpend = params.teams * RUOLI.reduce((a, r) => a + params.slots[r], 0);
  const extra = Math.max(0, monte - minSpend);
  const prices = new Map<number, number>();
  for (const p of players) {
    const share = sumVorp > 0 ? vorp.get(p.id)! / sumVorp : 0;
    prices.set(p.id, 1 + Math.round(extra * share));
  }
  return prices;
}
```

- [ ] **Step 4: Esegui — PASS (6 test) + typecheck**

- [ ] **Step 5: Commit**

```powershell
git add app/src/domain
git commit -m "feat: per-league fair prices from valueScore (VORP scaling)"
```

---

### Task 4: Store leghe (max 5, persist, modalità riparazione)

**Files:**
- Create: `app/src/store/leagues.ts`
- Test: `app/src/store/__tests__/leagues.test.ts`

**Interfaces:**
- Consumes: `types.ts` (`League`, `TeamConfig`, `Ruolo`)
- Produces (Zustand store, usabile anche fuori React con `useLeagues.getState()`):
  - `createLeague(input: { nome: string; teamNames: string[]; crediti: number; slots?: Record<Ruolo, number>; myTeamIndex?: number }): League` — lancia `Error("massimo 5 leghe")` alla sesta; genera id/team id con `newId()`
  - `updateLeague(id: string, patch: Partial<Pick<League, "nome" | "slots" | "myTeamIndex">>): void`
  - `setTeamRoster(leagueId: string, teamId: string, roster: { playerId: number; prezzo: number }[], creditiResidui: number): void` — modalità riparazione
  - `deleteLeague(id: string): void`
  - `setActiveLeague(id: string): void`; stato: `{ leagues: League[]; activeLeagueId: string | null }`
  - `MAX_LEAGUES = 5` (gli id vengono da `newId()` di `src/domain/ids.ts`, Task 2)
  - persistenza: middleware `persist` con storage AsyncStorage (nome chiave `"fanta-leagues"`)

- [ ] **Step 1: Installa le dipendenze**

```powershell
Set-Location D:\railway\fantacalcio\app
npm i zustand
npx expo install @react-native-async-storage/async-storage
```

- [ ] **Step 2: Scrivi i test**

`app/src/store/__tests__/leagues.test.ts`:
```ts
import { useLeagues, MAX_LEAGUES } from "../leagues";

const input = (nome: string) => ({
  nome, teamNames: ["Io", "Avv1", "Avv2", "Avv3"], crediti: 500,
});

beforeEach(() => {
  useLeagues.setState({ leagues: [], activeLeagueId: null });
});

test("crea una lega con default corretti", () => {
  const l = useLeagues.getState().createLeague(input("Lega A"));
  expect(l.slots).toEqual({ P: 3, D: 8, C: 8, A: 6 });
  expect(l.teams).toHaveLength(4);
  expect(l.teams[0].crediti).toBe(500);
  expect(l.myTeamIndex).toBe(0);
  expect(useLeagues.getState().activeLeagueId).toBe(l.id);
});

test("massimo 5 leghe", () => {
  for (let i = 0; i < MAX_LEAGUES; i++) {
    useLeagues.getState().createLeague(input(`Lega ${i}`));
  }
  expect(() => useLeagues.getState().createLeague(input("Sesta"))).toThrow(/massimo 5/i);
});

test("modalità riparazione: rosa iniziale e crediti residui", () => {
  const l = useLeagues.getState().createLeague(input("Riparazione"));
  const team = l.teams[1];
  useLeagues.getState().setTeamRoster(l.id, team.id, [{ playerId: 7, prezzo: 40 }], 120);
  const updated = useLeagues.getState().leagues.find(x => x.id === l.id)!;
  expect(updated.teams[1].rosterIniziale).toEqual([{ playerId: 7, prezzo: 40 }]);
  expect(updated.teams[1].crediti).toBe(120);
});

test("update e delete", () => {
  const l = useLeagues.getState().createLeague(input("Lega A"));
  useLeagues.getState().updateLeague(l.id, { nome: "Rinominata" });
  expect(useLeagues.getState().leagues[0].nome).toBe("Rinominata");
  useLeagues.getState().deleteLeague(l.id);
  expect(useLeagues.getState().leagues).toHaveLength(0);
  expect(useLeagues.getState().activeLeagueId).toBeNull();
});
```

- [ ] **Step 3: Esegui — FAIL**

Run: `npm test -- --watchAll=false leagues`

- [ ] **Step 4: Implementa `src/store/leagues.ts`**

```ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { League, Ruolo, TeamConfig } from "../domain/types";
import { newId } from "../domain/ids";

export const MAX_LEAGUES = 5;
export const DEFAULT_SLOTS: Record<Ruolo, number> = { P: 3, D: 8, C: 8, A: 6 };

interface CreateInput {
  nome: string; teamNames: string[]; crediti: number;
  slots?: Record<Ruolo, number>; myTeamIndex?: number;
}

interface LeaguesState {
  leagues: League[];
  activeLeagueId: string | null;
  createLeague(input: CreateInput): League;
  updateLeague(id: string, patch: Partial<Pick<League, "nome" | "slots" | "myTeamIndex">>): void;
  setTeamRoster(leagueId: string, teamId: string,
    roster: { playerId: number; prezzo: number }[], creditiResidui: number): void;
  deleteLeague(id: string): void;
  setActiveLeague(id: string): void;
}

export const useLeagues = create<LeaguesState>()(
  persist(
    (set, get) => ({
      leagues: [],
      activeLeagueId: null,

      createLeague(input) {
        if (get().leagues.length >= MAX_LEAGUES) throw new Error("massimo 5 leghe");
        const teams: TeamConfig[] = input.teamNames.map(nome => ({
          id: newId(), nome, crediti: input.crediti, rosterIniziale: [],
        }));
        const league: League = {
          id: newId(), nome: input.nome, slots: input.slots ?? { ...DEFAULT_SLOTS },
          teams, myTeamIndex: input.myTeamIndex ?? 0,
          createdAt: new Date().toISOString(),
        };
        set(s => ({ leagues: [...s.leagues, league], activeLeagueId: league.id }));
        return league;
      },

      updateLeague(id, patch) {
        set(s => ({ leagues: s.leagues.map(l => (l.id === id ? { ...l, ...patch } : l)) }));
      },

      setTeamRoster(leagueId, teamId, roster, creditiResidui) {
        set(s => ({
          leagues: s.leagues.map(l => l.id !== leagueId ? l : {
            ...l,
            teams: l.teams.map(t => t.id !== teamId ? t
              : { ...t, rosterIniziale: roster, crediti: creditiResidui }),
          }),
        }));
      },

      deleteLeague(id) {
        set(s => ({
          leagues: s.leagues.filter(l => l.id !== id),
          activeLeagueId: s.activeLeagueId === id ? null : s.activeLeagueId,
        }));
      },

      setActiveLeague(id) { set({ activeLeagueId: id }); },
    }),
    { name: "fanta-leagues", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
```

Nota jest: jest-expo mocka AsyncStorage automaticamente; se il test lamenta il modulo nativo, aggiungi in `package.json` → `jest`:
`"setupFiles": ["./jest.setup.js"]` con `jest.setup.js`:
```js
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
```

- [ ] **Step 5: Esegui — PASS (4 test) + typecheck**

- [ ] **Step 6: Commit**

```powershell
git add app
git commit -m "feat: multi-league store with persistence and repair mode"
```

---

### Task 5: Stato asta (registra/undo/correggi + validazioni)

**Files:**
- Create: `app/src/domain/auction.ts`
- Test: `app/src/domain/__tests__/auction.test.ts`

**Interfaces:**
- Consumes: `types.ts` (`League`, `AuctionState`, `Purchase`, `Ruolo`)
- Produces (funzioni PURE — lo store che le persiste arriva nel Task 8):
  - `emptyAuction(leagueId: string): AuctionState`
  - `registerPurchase(state: AuctionState, league: League, players: Map<number, Player>, p: { playerId: number; teamId: string; prezzo: number }): AuctionState` — lancia `AuctionError` con messaggi: `"giocatore già acquistato"`, `"squadra sconosciuta"`, `"prezzo minimo 1"`, `"budget insufficiente: restano N crediti utilizzabili"`, `"slot RUOLO pieni"`
  - `undoLast(state: AuctionState): AuctionState`
  - `removePurchase(state: AuctionState, purchaseId: string): AuctionState`
  - `editPurchase(state: AuctionState, league: League, players: Map<number, Player>, purchaseId: string, patch: { teamId?: string; prezzo?: number }): AuctionState` (rimuove e re-registra con le stesse validazioni)
  - `teamSummary(state: AuctionState, league: League, players: Map<number, Player>, teamId: string): { spesi: number; residui: number; slotLiberi: Record<Ruolo, number>; maxOfferta: number; rosa: { playerId: number; prezzo: number }[] }`
    - `residui = crediti − spesi` (i `rosterIniziale` occupano slot ma NON scalano crediti: in riparazione `crediti` è già il residuo)
    - `slotLiberi[r] = slots[r] − (iniziali di ruolo r) − (acquisti di ruolo r)`
    - `maxOfferta = residui − (slotLiberiTotali − 1)` (≥ 0; deve restare 1 credito per ogni altro slot vuoto)
  - `class AuctionError extends Error`

- [ ] **Step 1: Scrivi i test**

`app/src/domain/__tests__/auction.test.ts`:
```ts
import {
  emptyAuction, registerPurchase, undoLast, removePurchase, editPurchase,
  teamSummary, AuctionError,
} from "../auction";
import { miniDataset } from "./fixtures";
import type { League, Player } from "../types";

function league(): League {
  return {
    id: "L1", nome: "Test", slots: { P: 1, D: 1, C: 1, A: 1 },
    teams: [
      { id: "T1", nome: "Io", crediti: 100, rosterIniziale: [] },
      { id: "T2", nome: "Avv", crediti: 100, rosterIniziale: [] },
    ],
    myTeamIndex: 0, createdAt: "2026-08-13",
  };
}
const ds = miniDataset();
const byId = new Map<number, Player>(ds.players.map(p => [p.id, p]));
const att = ds.players.find(p => p.nome === "AttTop")!;
const attLow = ds.players.find(p => p.nome === "AttLow")!;
const por = ds.players.find(p => p.nome === "PortiereTop")!;

test("registra un acquisto e aggiorna il riepilogo", () => {
  let st = emptyAuction("L1");
  st = registerPurchase(st, league(), byId, { playerId: att.id, teamId: "T1", prezzo: 60 });
  const sum = teamSummary(st, league(), byId, "T1");
  expect(sum.spesi).toBe(60);
  expect(sum.residui).toBe(40);
  expect(sum.slotLiberi.A).toBe(0);
  // 3 slot liberi restanti (P,D,C) -> maxOfferta = 40 - 2 = 38
  expect(sum.maxOfferta).toBe(38);
});

test("giocatore già venduto -> errore", () => {
  let st = emptyAuction("L1");
  st = registerPurchase(st, league(), byId, { playerId: att.id, teamId: "T1", prezzo: 10 });
  expect(() => registerPurchase(st, league(), byId, { playerId: att.id, teamId: "T2", prezzo: 5 }))
    .toThrow(/già acquistato/);
});

test("slot pieni -> errore", () => {
  let st = emptyAuction("L1");
  st = registerPurchase(st, league(), byId, { playerId: att.id, teamId: "T1", prezzo: 10 });
  expect(() => registerPurchase(st, league(), byId, { playerId: attLow.id, teamId: "T1", prezzo: 5 }))
    .toThrow(/slot A pieni/);
});

test("budget: deve restare 1 credito per ogni slot vuoto", () => {
  let st = emptyAuction("L1");
  // 4 slot vuoti, 100 crediti -> max offerta 97
  expect(() => registerPurchase(st, league(), byId, { playerId: att.id, teamId: "T1", prezzo: 98 }))
    .toThrow(AuctionError);
  st = registerPurchase(st, league(), byId, { playerId: att.id, teamId: "T1", prezzo: 97 });
  expect(teamSummary(st, league(), byId, "T1").residui).toBe(3);
});

test("undo e remove", () => {
  let st = emptyAuction("L1");
  st = registerPurchase(st, league(), byId, { playerId: att.id, teamId: "T1", prezzo: 10 });
  st = registerPurchase(st, league(), byId, { playerId: por.id, teamId: "T2", prezzo: 5 });
  st = undoLast(st);
  expect(st.purchases).toHaveLength(1);
  st = removePurchase(st, st.purchases[0].id);
  expect(st.purchases).toHaveLength(0);
});

test("edit re-valida (prezzo eccessivo rifiutato)", () => {
  let st = emptyAuction("L1");
  st = registerPurchase(st, league(), byId, { playerId: att.id, teamId: "T1", prezzo: 10 });
  expect(() => editPurchase(st, league(), byId, st.purchases[0].id, { prezzo: 98 }))
    .toThrow(AuctionError);
  st = editPurchase(st, league(), byId, st.purchases[0].id, { prezzo: 50 });
  expect(st.purchases[0].prezzo).toBe(50);
});

test("modalità riparazione: roster iniziale occupa slot", () => {
  const l = league();
  l.teams[0].rosterIniziale = [{ playerId: por.id, prezzo: 20 }];
  l.teams[0].crediti = 80; // residui
  const st = emptyAuction("L1");
  const sum = teamSummary(st, l, byId, "T1");
  expect(sum.slotLiberi.P).toBe(0);
  expect(sum.residui).toBe(80);
  expect(() => registerPurchase(st, l, byId, { playerId: ds.players[1].id, teamId: "T1", prezzo: 5 }))
    .toThrow(/slot P pieni/);
});
```

- [ ] **Step 2: Esegui — FAIL**

Run: `npm test -- --watchAll=false auction`

- [ ] **Step 3: Implementa `src/domain/auction.ts`**

```ts
import type { AuctionState, League, Player, Purchase, Ruolo } from "./types";
import { newId } from "./ids";

export class AuctionError extends Error {}

const RUOLI: Ruolo[] = ["P", "D", "C", "A"];

export function emptyAuction(leagueId: string): AuctionState {
  return { leagueId, purchases: [] };
}

export function teamSummary(state: AuctionState, league: League,
  players: Map<number, Player>, teamId: string) {
  const team = league.teams.find(t => t.id === teamId);
  if (!team) throw new AuctionError("squadra sconosciuta");
  const acquisti = state.purchases.filter(p => p.teamId === teamId);
  const spesi = acquisti.reduce((a, p) => a + p.prezzo, 0);
  const residui = team.crediti - spesi;
  const slotLiberi = {} as Record<Ruolo, number>;
  for (const r of RUOLI) {
    const iniziali = team.rosterIniziale
      .filter(x => players.get(x.playerId)?.ruolo === r).length;
    const comprati = acquisti.filter(p => players.get(p.playerId)?.ruolo === r).length;
    slotLiberi[r] = league.slots[r] - iniziali - comprati;
  }
  const slotTot = RUOLI.reduce((a, r) => a + slotLiberi[r], 0);
  const maxOfferta = Math.max(0, residui - Math.max(0, slotTot - 1));
  const rosa = [
    ...team.rosterIniziale,
    ...acquisti.map(p => ({ playerId: p.playerId, prezzo: p.prezzo })),
  ];
  return { spesi, residui, slotLiberi, maxOfferta, rosa };
}

export function registerPurchase(state: AuctionState, league: League,
  players: Map<number, Player>,
  p: { playerId: number; teamId: string; prezzo: number }): AuctionState {
  const player = players.get(p.playerId);
  if (!player) throw new AuctionError("giocatore sconosciuto");
  const giaVenduto = state.purchases.some(x => x.playerId === p.playerId)
    || league.teams.some(t => t.rosterIniziale.some(x => x.playerId === p.playerId));
  if (giaVenduto) throw new AuctionError("giocatore già acquistato");
  if (p.prezzo < 1) throw new AuctionError("prezzo minimo 1");
  const sum = teamSummary(state, league, players, p.teamId);
  if (sum.slotLiberi[player.ruolo] <= 0)
    throw new AuctionError(`slot ${player.ruolo} pieni`);
  if (p.prezzo > sum.maxOfferta)
    throw new AuctionError(`budget insufficiente: restano ${sum.maxOfferta} crediti utilizzabili`);
  const purchase: Purchase = { id: newId(), ...p, ts: new Date().toISOString() };
  return { ...state, purchases: [...state.purchases, purchase] };
}

export function undoLast(state: AuctionState): AuctionState {
  return { ...state, purchases: state.purchases.slice(0, -1) };
}

export function removePurchase(state: AuctionState, purchaseId: string): AuctionState {
  return { ...state, purchases: state.purchases.filter(p => p.id !== purchaseId) };
}

export function editPurchase(state: AuctionState, league: League,
  players: Map<number, Player>, purchaseId: string,
  patch: { teamId?: string; prezzo?: number }): AuctionState {
  const orig = state.purchases.find(p => p.id === purchaseId);
  if (!orig) throw new AuctionError("acquisto inesistente");
  const without = removePurchase(state, purchaseId);
  const reregistered = registerPurchase(without, league, players, {
    playerId: orig.playerId,
    teamId: patch.teamId ?? orig.teamId,
    prezzo: patch.prezzo ?? orig.prezzo,
  });
  // mantieni l'ordine originale: reinserisci nella stessa posizione
  const nuovo = reregistered.purchases[reregistered.purchases.length - 1];
  const idx = state.purchases.findIndex(p => p.id === purchaseId);
  const purchases = [...without.purchases];
  purchases.splice(idx, 0, nuovo);
  return { ...state, purchases };
}
```

- [ ] **Step 4: Esegui — PASS (7 test) + typecheck**

- [ ] **Step 5: Commit**

```powershell
git add app/src/domain
git commit -m "feat: auction state with validated purchases, undo and repair mode"
```

---

### Task 6: Aggiustamenti live (Fase C)

**Files:**
- Create: `app/src/domain/live.ts`
- Test: `app/src/domain/__tests__/live.test.ts`

**Interfaces:**
- Consumes: `prices.ts` (`computeLeaguePrices`, `LeagueParams`), `auction.ts` (`teamSummary`), `types.ts`
- Produces:
  - `computeLive(dataset: Player[], league: League, auction: AuctionState): LiveContext`
  - `interface LiveContext { adjustedPrice(playerId: number): number; bidAdvice(playerId: number): BidAdvice; scarcity: Record<Ruolo, number>; }`
  - `interface BidAdvice { equoLive: number; maxConsigliato: number; mioMax: number; avversari: { teamId: string; nome: string; max: number }[] }`

Formule (spec §5 Fase C):
- Prezzi base da `computeLeaguePrices` con `LeagueParams` derivati dalla lega (`teams: league.teams.length`, `creditiPerTeam`: media crediti configurati, `slots`).
- Correzione live (inflazione implicita): `freeMoney = Σ residui − Σ slotLiberi` (denaro sopra il minimo 1cr/slot ancora in circolo); `unsoldExtra = Σ (equo_i − 1)` sui non venduti; `equoLive_i = 1 + round((equo_i − 1) × freeMoney / unsoldExtra)` (se `unsoldExtra = 0` → equo base; clamp ≥ 1).
- Scarsità per ruolo: `slotsNeeded_r = Σ team slotLiberi[r]`; `topAvail_r` = non venduti di ruolo r con fascia top/semitop; `scarcity_r = 1 + 0.2 × max(0, 1 − topAvail_r / max(1, slotsNeeded_r))` (cap implicito 1.2; vale solo per giocatori top/semitop, per gli altri 1.0).
- `maxConsigliato = min(mioMax, round(equoLive × scarcityFactor))`; `mioMax` = `teamSummary(...).maxOfferta` della mia squadra (0 se slot del ruolo pieni); `avversari`: per ogni altra squadra `max = maxOfferta` se ha slot liberi nel ruolo, altrimenti 0.

- [ ] **Step 1: Scrivi i test**

`app/src/domain/__tests__/live.test.ts`:
```ts
import { computeLive } from "../live";
import { emptyAuction, registerPurchase } from "../auction";
import { miniDataset } from "./fixtures";
import type { League, Player } from "../types";

function league(): League {
  return {
    id: "L1", nome: "Test", slots: { P: 1, D: 1, C: 1, A: 1 },
    teams: [
      { id: "T1", nome: "Io", crediti: 100, rosterIniziale: [] },
      { id: "T2", nome: "Avv", crediti: 100, rosterIniziale: [] },
    ],
    myTeamIndex: 0, createdAt: "2026-08-13",
  };
}
const ds = miniDataset();
const byId = new Map<number, Player>(ds.players.map(p => [p.id, p]));
const att = ds.players.find(p => p.nome === "AttTop")!;
const attLow = ds.players.find(p => p.nome === "AttLow")!;
const cen = ds.players.find(p => p.nome === "CenTop")!;

test("senza acquisti, equoLive ~ equo base", () => {
  const live = computeLive(ds.players, league(), emptyAuction("L1"));
  const advice = live.bidAdvice(att.id);
  expect(advice.equoLive).toBeGreaterThan(1);
  expect(advice.mioMax).toBe(97); // 100 - (4-1)
  expect(advice.avversari[0].max).toBe(97);
});

test("se la lega strapaga, i prezzi live dei rimanenti scendono", () => {
  const l = league();
  let st = emptyAuction("L1");
  // T2 strapaga AttTop: 90 crediti
  st = registerPurchase(st, l, byId, { playerId: att.id, teamId: "T2", prezzo: 90 });
  const live = computeLive(ds.players, l, st);
  const base = computeLive(ds.players, l, emptyAuction("L1"));
  expect(live.bidAdvice(cen.id).equoLive).toBeLessThan(base.bidAdvice(cen.id).equoLive);
});

test("venduto un top di ruolo, il rimanente di fascia alta vale di più (scarsità)", () => {
  const l = league();
  let st = emptyAuction("L1");
  st = registerPurchase(st, l, byId, { playerId: att.id, teamId: "T2", prezzo: 10 });
  const live = computeLive(ds.players, l, st);
  // ruolo A: topAvail=0 (AttTop venduto, AttLow è "scommessa"), slotsNeeded=1 -> scarcity 1.2
  expect(live.scarcity.A).toBeCloseTo(1.2, 5);
});

test("slot del ruolo pieni -> mioMax 0", () => {
  const l = league();
  let st = emptyAuction("L1");
  st = registerPurchase(st, l, byId, { playerId: att.id, teamId: "T1", prezzo: 10 });
  const live = computeLive(ds.players, l, st);
  expect(live.bidAdvice(attLow.id).mioMax).toBe(0);
});

test("maxConsigliato non supera mai mioMax", () => {
  const l = league();
  l.teams[0].crediti = 10; // budget minuscolo
  const live = computeLive(ds.players, l, emptyAuction("L1"));
  const advice = live.bidAdvice(att.id);
  expect(advice.maxConsigliato).toBeLessThanOrEqual(advice.mioMax);
});
```

- [ ] **Step 2: Esegui — FAIL**

Run: `npm test -- --watchAll=false live`

- [ ] **Step 3: Implementa `src/domain/live.ts`**

```ts
import type { AuctionState, League, Player, Ruolo } from "./types";
import { computeLeaguePrices } from "./prices";
import { teamSummary } from "./auction";

export interface BidAdvice {
  equoLive: number; maxConsigliato: number; mioMax: number;
  avversari: { teamId: string; nome: string; max: number }[];
}

export interface LiveContext {
  adjustedPrice(playerId: number): number;
  bidAdvice(playerId: number): BidAdvice;
  scarcity: Record<Ruolo, number>;
}

const RUOLI: Ruolo[] = ["P", "D", "C", "A"];
const FASCE_ALTE = new Set(["top", "semitop"]);

export function computeLive(players: Player[], league: League,
  auction: AuctionState): LiveContext {
  const byId = new Map(players.map(p => [p.id, p]));
  const creditiMedi = league.teams.reduce((a, t) => a + t.crediti, 0) / league.teams.length;
  const basePrices = computeLeaguePrices(players, {
    teams: league.teams.length, creditiPerTeam: creditiMedi, slots: league.slots,
  });

  const summaries = league.teams.map(t => ({
    team: t, sum: teamSummary(auction, league, byId, t.id),
  }));
  const soldIds = new Set([
    ...auction.purchases.map(p => p.playerId),
    ...league.teams.flatMap(t => t.rosterIniziale.map(x => x.playerId)),
  ]);

  const freeMoney = summaries.reduce((a, { sum }) =>
    a + Math.max(0, sum.residui - RUOLI.reduce((s, r) => s + sum.slotLiberi[r], 0)), 0);
  const unsold = players.filter(p => !soldIds.has(p.id));
  const unsoldExtra = unsold.reduce((a, p) => a + (basePrices.get(p.id)! - 1), 0);

  function adjustedPrice(playerId: number): number {
    const base = basePrices.get(playerId) ?? 1;
    if (unsoldExtra <= 0) return base;
    return Math.max(1, 1 + Math.round((base - 1) * freeMoney / unsoldExtra));
  }

  const scarcity = {} as Record<Ruolo, number>;
  for (const r of RUOLI) {
    const slotsNeeded = summaries.reduce((a, { sum }) => a + Math.max(0, sum.slotLiberi[r]), 0);
    const topAvail = unsold.filter(p => p.ruolo === r && FASCE_ALTE.has(p.fascia)).length;
    scarcity[r] = 1 + 0.2 * Math.max(0, 1 - topAvail / Math.max(1, slotsNeeded));
  }

  function bidAdvice(playerId: number): BidAdvice {
    const player = byId.get(playerId);
    const ruolo = player?.ruolo ?? "A";
    const equoLive = adjustedPrice(playerId);
    const fattore = player && FASCE_ALTE.has(player.fascia) ? scarcity[ruolo] : 1;
    const mine = summaries[league.myTeamIndex];
    const mioMax = mine.sum.slotLiberi[ruolo] > 0 ? mine.sum.maxOfferta : 0;
    const avversari = summaries
      .filter((_, i) => i !== league.myTeamIndex)
      .map(({ team, sum }) => ({
        teamId: team.id, nome: team.nome,
        max: sum.slotLiberi[ruolo] > 0 ? sum.maxOfferta : 0,
      }));
    return {
      equoLive,
      maxConsigliato: Math.min(mioMax, Math.round(equoLive * fattore)),
      mioMax, avversari,
    };
  }

  return { adjustedPrice, bidAdvice, scarcity };
}
```

- [ ] **Step 4: Esegui — PASS (5 test) + typecheck**

- [ ] **Step 5: Commit**

```powershell
git add app/src/domain
git commit -m "feat: live auction adjustments (implicit inflation, scarcity, bid advice)"
```

---

### Task 7: Servizio dataset (download, cache, import)

**Files:**
- Create: `app/src/services/datasetService.ts`
- Test: `app/src/services/__tests__/datasetService.test.ts`

**Interfaces:**
- Consumes: `parseDataset`, `Dataset`
- Produces:
  - `DATASET_URL = "https://raw.githubusercontent.com/Cilluzzo79/fantacalcio/master/data/dataset.json"`
  - `loadLocalDataset(deps?: Deps): Promise<Dataset | null>` — legge il file locale se esiste, null altrimenti
  - `refreshDataset(current: Dataset | null, deps?: Deps): Promise<{ dataset: Dataset; updated: boolean }>` — scarica dall'URL; se `generatedAt` più recente del corrente lo salva su file e ritorna `updated: true`; su errore di rete/parse ritorna il corrente (`updated: false`); se non c'è né remoto né corrente lancia `DatasetError`
  - `importDatasetFromText(text: string, deps?: Deps): Promise<Dataset>` — parse + salva (usato dal document picker nel Piano 2b)
  - `isStale(ds: Dataset, nowIso: string): boolean` — true se `generatedAt` più vecchio di 30 giorni
  - `interface Deps { fetchFn: typeof fetch; readFile(path: string): Promise<string | null>; writeFile(path: string, content: string): Promise<void>; }` — default: fetch globale + expo-file-system (`FileSystem.documentDirectory + "dataset.json"`); i test iniettano fake in-memory

- [ ] **Step 1: Scrivi i test**

`app/src/services/__tests__/datasetService.test.ts`:
```ts
import {
  loadLocalDataset, refreshDataset, importDatasetFromText, isStale,
} from "../datasetService";
import { miniDataset } from "../../domain/__tests__/fixtures";

function fakeDeps(files: Record<string, string> = {}, remote?: object | Error) {
  return {
    files,
    deps: {
      fetchFn: (async () => {
        if (remote instanceof Error) throw remote;
        if (!remote) return { ok: false, status: 404 } as Response;
        return { ok: true, status: 200, json: async () => remote } as unknown as Response;
      }) as typeof fetch,
      readFile: async (p: string) => files[p] ?? null,
      writeFile: async (p: string, c: string) => { files[p] = c; },
    },
  };
}

test("loadLocalDataset: null senza file, dataset col file", async () => {
  const { deps } = fakeDeps();
  expect(await loadLocalDataset(deps)).toBeNull();
  const withFile = fakeDeps({ "dataset.json": JSON.stringify(miniDataset()) });
  expect((await loadLocalDataset(withFile.deps))!.players).toHaveLength(8);
});

test("refreshDataset scarica e salva se più recente", async () => {
  const vecchio = { ...miniDataset(), generatedAt: "2026-08-01T00:00:00+00:00" };
  const nuovo = { ...miniDataset(), generatedAt: "2026-08-13T00:00:00+00:00" };
  const { files, deps } = fakeDeps({}, nuovo);
  const res = await refreshDataset(vecchio, deps);
  expect(res.updated).toBe(true);
  expect(res.dataset.generatedAt).toBe(nuovo.generatedAt);
  expect(files["dataset.json"]).toContain(nuovo.generatedAt);
});

test("refreshDataset ignora un remoto più vecchio", async () => {
  const corrente = { ...miniDataset(), generatedAt: "2026-08-13T00:00:00+00:00" };
  const remoto = { ...miniDataset(), generatedAt: "2026-08-01T00:00:00+00:00" };
  const { deps } = fakeDeps({}, remoto);
  const res = await refreshDataset(corrente, deps);
  expect(res.updated).toBe(false);
  expect(res.dataset.generatedAt).toBe(corrente.generatedAt);
});

test("offline: ritorna il corrente senza errori", async () => {
  const corrente = miniDataset();
  const { deps } = fakeDeps({}, new Error("network down"));
  const res = await refreshDataset(corrente, deps);
  expect(res.updated).toBe(false);
  expect(res.dataset).toBe(corrente);
});

test("offline e nessun corrente -> DatasetError", async () => {
  const { deps } = fakeDeps({}, new Error("network down"));
  await expect(refreshDataset(null, deps)).rejects.toThrow(/dataset/i);
});

test("import da testo: valida e salva", async () => {
  const { files, deps } = fakeDeps();
  const ds = await importDatasetFromText(JSON.stringify(miniDataset()), deps);
  expect(ds.players).toHaveLength(8);
  expect(files["dataset.json"]).toBeTruthy();
  await expect(importDatasetFromText("{}", deps)).rejects.toThrow();
});

test("isStale a 30 giorni", () => {
  const ds = { ...miniDataset(), generatedAt: "2026-07-01T00:00:00+00:00" };
  expect(isStale(ds, "2026-08-13T00:00:00+00:00")).toBe(true);
  expect(isStale(ds, "2026-07-15T00:00:00+00:00")).toBe(false);
});
```

- [ ] **Step 2: Esegui — FAIL**

Run: `npm test -- --watchAll=false datasetService`

- [ ] **Step 3: Implementa `src/services/datasetService.ts`**

```powershell
npx expo install expo-file-system
```

```ts
import * as FileSystem from "expo-file-system";
import { parseDataset, DatasetError } from "../domain/dataset";
import type { Dataset } from "../domain/types";

export const DATASET_URL =
  "https://raw.githubusercontent.com/Cilluzzo79/fantacalcio/master/data/dataset.json";
const LOCAL_PATH = "dataset.json";
const STALE_DAYS = 30;

export interface Deps {
  fetchFn: typeof fetch;
  readFile(path: string): Promise<string | null>;
  writeFile(path: string, content: string): Promise<void>;
}

function defaultDeps(): Deps {
  const dir = FileSystem.documentDirectory ?? "";
  return {
    fetchFn: fetch,
    async readFile(path) {
      const info = await FileSystem.getInfoAsync(dir + path);
      if (!info.exists) return null;
      return FileSystem.readAsStringAsync(dir + path);
    },
    async writeFile(path, content) {
      await FileSystem.writeAsStringAsync(dir + path, content);
    },
  };
}

export async function loadLocalDataset(deps: Deps = defaultDeps()): Promise<Dataset | null> {
  const raw = await deps.readFile(LOCAL_PATH);
  if (raw === null) return null;
  try {
    return parseDataset(JSON.parse(raw));
  } catch {
    return null; // file corrotto: come se non ci fosse (verrà riscaricato)
  }
}

export async function refreshDataset(current: Dataset | null,
  deps: Deps = defaultDeps()): Promise<{ dataset: Dataset; updated: boolean }> {
  let remote: Dataset | null = null;
  try {
    const res = await deps.fetchFn(DATASET_URL);
    if (res.ok) remote = parseDataset(await res.json());
  } catch {
    remote = null; // offline o parse fallito: si prosegue col corrente
  }
  if (remote && (!current || remote.generatedAt > current.generatedAt)) {
    await deps.writeFile(LOCAL_PATH, JSON.stringify(remote));
    return { dataset: remote, updated: true };
  }
  if (current) return { dataset: current, updated: false };
  throw new DatasetError("nessun dataset disponibile: scarica o importa il file");
}

export async function importDatasetFromText(text: string,
  deps: Deps = defaultDeps()): Promise<Dataset> {
  const ds = parseDataset(JSON.parse(text));
  await deps.writeFile(LOCAL_PATH, JSON.stringify(ds));
  return ds;
}

export function isStale(ds: Dataset, nowIso: string): boolean {
  const ageMs = Date.parse(nowIso) - Date.parse(ds.generatedAt);
  return ageMs > STALE_DAYS * 24 * 3600 * 1000;
}
```

- [ ] **Step 4: Esegui — PASS (7 test) + typecheck**

- [ ] **Step 5: Commit**

```powershell
git add app
git commit -m "feat: dataset service with remote refresh, cache and import"
```

---

### Task 8: Store asta per lega (persistenza crash-safe)

**Files:**
- Create: `app/src/store/auctions.ts`
- Test: `app/src/store/__tests__/auctions.test.ts`

**Interfaces:**
- Consumes: `auction.ts` (funzioni pure), `types.ts`
- Produces (Zustand + persist, chiave `"fanta-auctions"`; stato `{ byLeague: Record<string, AuctionState> }`):
  - `getAuction(leagueId: string): AuctionState` (crea vuota se assente)
  - `purchase(leagueId, league, players, p): void` — applica `registerPurchase` e salva; propaga `AuctionError`
  - `undo(leagueId): void`, `remove(leagueId, purchaseId): void`, `edit(leagueId, league, players, purchaseId, patch): void`
  - `resetAuction(leagueId): void`

- [ ] **Step 1: Scrivi i test**

`app/src/store/__tests__/auctions.test.ts`:
```ts
import { useAuctions } from "../auctions";
import { miniDataset } from "../../domain/__tests__/fixtures";
import { AuctionError } from "../../domain/auction";
import type { League, Player } from "../../domain/types";

function league(): League {
  return {
    id: "L1", nome: "Test", slots: { P: 1, D: 1, C: 1, A: 1 },
    teams: [
      { id: "T1", nome: "Io", crediti: 100, rosterIniziale: [] },
      { id: "T2", nome: "Avv", crediti: 100, rosterIniziale: [] },
    ],
    myTeamIndex: 0, createdAt: "2026-08-13",
  };
}
const ds = miniDataset();
const byId = new Map<number, Player>(ds.players.map(p => [p.id, p]));
const att = ds.players.find(p => p.nome === "AttTop")!;

beforeEach(() => useAuctions.setState({ byLeague: {} }));

test("purchase registra e getAuction riflette lo stato", () => {
  useAuctions.getState().purchase("L1", league(), byId,
    { playerId: att.id, teamId: "T1", prezzo: 30 });
  expect(useAuctions.getState().getAuction("L1").purchases).toHaveLength(1);
});

test("aste di leghe diverse sono indipendenti", () => {
  useAuctions.getState().purchase("L1", league(), byId,
    { playerId: att.id, teamId: "T1", prezzo: 30 });
  expect(useAuctions.getState().getAuction("L2").purchases).toHaveLength(0);
});

test("gli errori di validazione si propagano senza corrompere lo stato", () => {
  const st = useAuctions.getState();
  expect(() => st.purchase("L1", league(), byId,
    { playerId: att.id, teamId: "T1", prezzo: 99 })).toThrow(AuctionError);
  expect(st.getAuction("L1").purchases).toHaveLength(0);
});

test("undo, remove e reset", () => {
  const st = useAuctions.getState();
  st.purchase("L1", league(), byId, { playerId: att.id, teamId: "T1", prezzo: 30 });
  st.undo("L1");
  expect(st.getAuction("L1").purchases).toHaveLength(0);
  st.purchase("L1", league(), byId, { playerId: att.id, teamId: "T1", prezzo: 30 });
  st.remove("L1", st.getAuction("L1").purchases[0].id);
  expect(st.getAuction("L1").purchases).toHaveLength(0);
  st.purchase("L1", league(), byId, { playerId: att.id, teamId: "T1", prezzo: 30 });
  st.resetAuction("L1");
  expect(st.getAuction("L1").purchases).toHaveLength(0);
});
```

- [ ] **Step 2: Esegui — FAIL**

Run: `npm test -- --watchAll=false auctions`

- [ ] **Step 3: Implementa `src/store/auctions.ts`**

```ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuctionState, League, Player } from "../domain/types";
import {
  emptyAuction, registerPurchase, undoLast, removePurchase, editPurchase,
} from "../domain/auction";

interface AuctionsStore {
  byLeague: Record<string, AuctionState>;
  getAuction(leagueId: string): AuctionState;
  purchase(leagueId: string, league: League, players: Map<number, Player>,
    p: { playerId: number; teamId: string; prezzo: number }): void;
  undo(leagueId: string): void;
  remove(leagueId: string, purchaseId: string): void;
  edit(leagueId: string, league: League, players: Map<number, Player>,
    purchaseId: string, patch: { teamId?: string; prezzo?: number }): void;
  resetAuction(leagueId: string): void;
}

export const useAuctions = create<AuctionsStore>()(
  persist(
    (set, get) => ({
      byLeague: {},

      getAuction(leagueId) {
        return get().byLeague[leagueId] ?? emptyAuction(leagueId);
      },
      purchase(leagueId, league, players, p) {
        const next = registerPurchase(get().getAuction(leagueId), league, players, p);
        set(s => ({ byLeague: { ...s.byLeague, [leagueId]: next } }));
      },
      undo(leagueId) {
        const next = undoLast(get().getAuction(leagueId));
        set(s => ({ byLeague: { ...s.byLeague, [leagueId]: next } }));
      },
      remove(leagueId, purchaseId) {
        const next = removePurchase(get().getAuction(leagueId), purchaseId);
        set(s => ({ byLeague: { ...s.byLeague, [leagueId]: next } }));
      },
      edit(leagueId, league, players, purchaseId, patch) {
        const next = editPurchase(get().getAuction(leagueId), league, players, purchaseId, patch);
        set(s => ({ byLeague: { ...s.byLeague, [leagueId]: next } }));
      },
      resetAuction(leagueId) {
        set(s => {
          const byLeague = { ...s.byLeague };
          delete byLeague[leagueId];
          return { byLeague };
        });
      },
    }),
    { name: "fanta-auctions", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
```

- [ ] **Step 4: Esegui — PASS (4 test) + typecheck**

- [ ] **Step 5: Commit**

```powershell
git add app/src/store
git commit -m "feat: per-league auction store with crash-safe persistence"
```

---

### Task 9: UI minima navigabile

**Files:**
- Create/Modify: `app/app/_layout.tsx`, `app/app/(tabs)/_layout.tsx`, `app/app/(tabs)/index.tsx` (Home), `app/app/(tabs)/listone.tsx`
- Create: `app/src/store/dataset.ts` (store dataset in-memory + boot)

**Interfaces:**
- Consumes: tutto il dominio, `datasetService`, gli store
- Produces: app navigabile con 2 tab. NIENTE design curato (Piano 2b): componenti RN base, leggibili. Ma la logica visibile è REALE:
  - `src/store/dataset.ts`: store zustand NON persistito `{ dataset: Dataset | null; status: "loading" | "ready" | "missing"; boot(): Promise<void>; refresh(): Promise<boolean>; }` — `boot()` = `loadLocalDataset` → `refreshDataset` (best-effort); chiamato al mount del layout root
  - Home: stato dataset (season, generatedAt, n. giocatori, badge "vecchio" se `isStale`), bottone "Aggiorna"; lista leghe con crea (prompt semplice con `TextInput`: nome, n. squadre, crediti) e seleziona attiva
  - Listone: se c'è lega attiva e dataset: `FlatList` dei giocatori ordinati per prezzo equo desc (via `computeLeaguePrices`), con nome/ruolo/squadra/fascia/prezzo; `TextInput` di ricerca per nome (filtro case-insensitive)

- [ ] **Step 1: Implementa `src/store/dataset.ts`**

```ts
import { create } from "zustand";
import type { Dataset } from "../domain/types";
import { loadLocalDataset, refreshDataset } from "../services/datasetService";

interface DatasetStore {
  dataset: Dataset | null;
  status: "loading" | "ready" | "missing";
  boot(): Promise<void>;
  refresh(): Promise<boolean>;
}

export const useDataset = create<DatasetStore>()((set, get) => ({
  dataset: null,
  status: "loading",
  async boot() {
    const local = await loadLocalDataset();
    if (local) set({ dataset: local, status: "ready" });
    try {
      const { dataset, updated } = await refreshDataset(local);
      set({ dataset, status: "ready" });
      void updated;
    } catch {
      if (!get().dataset) set({ status: "missing" });
    }
  },
  async refresh() {
    const { dataset } = get();
    try {
      const res = await refreshDataset(dataset);
      set({ dataset: res.dataset, status: "ready" });
      return res.updated;
    } catch {
      return false;
    }
  },
}));
```

- [ ] **Step 2: Layout e tab**

`app/app/_layout.tsx`:
```tsx
import { useEffect } from "react";
import { Stack } from "expo-router";
import { useDataset } from "../src/store/dataset";

export default function RootLayout() {
  const boot = useDataset(s => s.boot);
  useEffect(() => { void boot(); }, [boot]);
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

`app/app/(tabs)/_layout.tsx`:
```tsx
import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: "Lega" }} />
      <Tabs.Screen name="listone" options={{ title: "Listone" }} />
    </Tabs>
  );
}
```

- [ ] **Step 3: Home (`app/app/(tabs)/index.tsx`)**

```tsx
import { useState } from "react";
import { Button, FlatList, Text, TextInput, View } from "react-native";
import { useDataset } from "../../src/store/dataset";
import { useLeagues } from "../../src/store/leagues";
import { isStale } from "../../src/services/datasetService";

export default function Home() {
  const { dataset, status, refresh } = useDataset();
  const { leagues, activeLeagueId, createLeague, setActiveLeague } = useLeagues();
  const [nome, setNome] = useState("");
  const [squadre, setSquadre] = useState("8");
  const [crediti, setCrediti] = useState("500");
  const [msg, setMsg] = useState<string | null>(null);

  function onCreate() {
    try {
      const n = Math.max(2, parseInt(squadre, 10) || 8);
      const teamNames = ["La mia squadra",
        ...Array.from({ length: n - 1 }, (_, i) => `Squadra ${i + 2}`)];
      createLeague({ nome: nome || `Lega ${leagues.length + 1}`,
        teamNames, crediti: Math.max(n * 25, parseInt(crediti, 10) || 500) });
      setMsg(null);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 8 }}>
      <Text style={{ fontSize: 18, fontWeight: "bold" }}>Dataset</Text>
      {status === "loading" && <Text>Caricamento…</Text>}
      {status === "missing" && <Text>Nessun dataset: serve connessione o import.</Text>}
      {dataset && (
        <Text>
          Stagione {dataset.season} · {dataset.players.length} giocatori ·
          aggiornato {dataset.generatedAt.slice(0, 10)}
          {isStale(dataset, new Date().toISOString()) ? " · VECCHIO" : ""}
        </Text>
      )}
      <Button title="Aggiorna dataset" onPress={() => void refresh()} />

      <Text style={{ fontSize: 18, fontWeight: "bold", marginTop: 16 }}>Leghe</Text>
      <TextInput placeholder="Nome lega" value={nome} onChangeText={setNome}
        style={{ borderWidth: 1, padding: 8 }} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput placeholder="Squadre" value={squadre} onChangeText={setSquadre}
          keyboardType="number-pad" style={{ borderWidth: 1, padding: 8, flex: 1 }} />
        <TextInput placeholder="Crediti" value={crediti} onChangeText={setCrediti}
          keyboardType="number-pad" style={{ borderWidth: 1, padding: 8, flex: 1 }} />
      </View>
      <Button title="Crea lega" onPress={onCreate} />
      {msg && <Text style={{ color: "red" }}>{msg}</Text>}
      <FlatList
        data={leagues}
        keyExtractor={l => l.id}
        renderItem={({ item }) => (
          <Text onPress={() => setActiveLeague(item.id)}
            style={{ padding: 8, fontWeight: item.id === activeLeagueId ? "bold" : "normal" }}>
            {item.id === activeLeagueId ? "▶ " : ""}{item.nome} · {item.teams.length} squadre
          </Text>
        )}
      />
    </View>
  );
}
```

- [ ] **Step 4: Listone (`app/app/(tabs)/listone.tsx`)**

```tsx
import { useMemo, useState } from "react";
import { FlatList, Text, TextInput, View } from "react-native";
import { useDataset } from "../../src/store/dataset";
import { useLeagues } from "../../src/store/leagues";
import { computeLeaguePrices } from "../../src/domain/prices";

export default function Listone() {
  const dataset = useDataset(s => s.dataset);
  const { leagues, activeLeagueId } = useLeagues();
  const league = leagues.find(l => l.id === activeLeagueId) ?? null;
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    if (!dataset || !league) return [];
    const creditiMedi = league.teams.reduce((a, t) => a + t.crediti, 0) / league.teams.length;
    const prices = computeLeaguePrices(dataset.players, {
      teams: league.teams.length, creditiPerTeam: creditiMedi, slots: league.slots,
    });
    return dataset.players
      .filter(p => p.nome.toLowerCase().includes(q.toLowerCase()))
      .map(p => ({ p, prezzo: prices.get(p.id) ?? 1 }))
      .sort((a, b) => b.prezzo - a.prezzo);
  }, [dataset, league, q]);

  if (!dataset) return <Text style={{ padding: 16 }}>Dataset non caricato.</Text>;
  if (!league) return <Text style={{ padding: 16 }}>Crea o seleziona una lega.</Text>;

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <TextInput placeholder="Cerca giocatore" value={q} onChangeText={setQ}
        style={{ borderWidth: 1, padding: 8, marginBottom: 8 }} />
      <FlatList
        data={rows}
        keyExtractor={r => String(r.p.id)}
        renderItem={({ item }) => (
          <View style={{ flexDirection: "row", paddingVertical: 6 }}>
            <Text style={{ width: 24, fontWeight: "bold" }}>{item.p.ruolo}</Text>
            <Text style={{ flex: 1 }}>{item.p.nome} · {item.p.squadra} · {item.p.fascia}</Text>
            <Text style={{ fontWeight: "bold" }}>{item.prezzo}</Text>
          </View>
        )}
      />
    </View>
  );
}
```

Se il template genera route diverse (es. `app/index.tsx` senza gruppo tabs), riorganizza per avere ESATTAMENTE le route `(tabs)/index` e `(tabs)/listone` con il layout Stack radice sopra.

- [ ] **Step 5: Verifica**

Run: `npm run typecheck` (pulito), `npm test -- --watchAll=false` (tutti i test dei task 1-8 ancora verdi), `npx expo export --platform android` (bundle senza errori — conferma che l'app compila davvero).

- [ ] **Step 6: Commit**

```powershell
git add app
git commit -m "feat: minimal navigable UI (home + listone with live league prices)"
```

---

### Task 10: Smoke finale + README app

**Files:**
- Create: `app/README.md`

**Interfaces:**
- Consumes: tutto
- Produces: documentazione minima; suite completa verde; bundle esportabile.

- [ ] **Step 1: `app/README.md`**

Contenuto (adatta i numeri reali):
```markdown
# Fantacalcio App (fondamenta — Piano 2a)

Expo + TypeScript. Dominio puro in `src/domain/` (prezzi per lega, asta, live),
servizi in `src/services/`, store Zustand persistiti in `src/store/`.

## Comandi
- `npm test -- --watchAll=false` — test Jest (~39)
- `npm run typecheck` — TypeScript strict
- `npx expo start` — dev server (app Expo Go sul telefono)
- `npx expo export --platform android` — verifica bundle

## Dati
Il dataset arriva da https://raw.githubusercontent.com/Cilluzzo79/fantacalcio/master/data/dataset.json
(cache locale in documentDirectory/dataset.json; refresh all'avvio, best-effort).

La UI completa (5 schermate con design) è il Piano 2b.
```

- [ ] **Step 2: Verifica finale completa**

Run (da `app/`): `npm test -- --watchAll=false` → TUTTI verdi; `npm run typecheck` → 0 errori; `npx expo export --platform android` → OK.

- [ ] **Step 3: Commit e push**

```powershell
Set-Location D:\railway\fantacalcio
git add app
git commit -m "docs: app foundations readme and final smoke"
git push
```

---

## Verifica finale del piano (per l'esecutore)

1. Suite Jest completa verde; `tsc --noEmit` pulito; `expo export` senza errori.
2. Sanity manuale della matematica: con una lega 8×500 e il dataset reale (quando disponibile), la somma dei prezzi equi ≈ 4000 e i top attaccanti costano centinaia di crediti.
3. L'app si avvia in Expo Go sul telefono dell'utente (verifica utente, non bloccante per il piano).
