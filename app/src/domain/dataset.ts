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
