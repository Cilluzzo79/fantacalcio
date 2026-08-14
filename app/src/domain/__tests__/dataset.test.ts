import { parseDataset, DatasetError } from "../dataset";
import { miniDataset } from "./fixtures";

test("parseDataset accetta un dataset valido", () => {
  const ds = parseDataset(JSON.parse(JSON.stringify(miniDataset())));
  expect(ds.players).toHaveLength(9);
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

test("parseDataset accetta e valida la chiave opzionale allenatori", () => {
  const base = miniDataset() as any;
  expect(parseDataset(base)).toBeTruthy(); // senza chiave: ok
  base.allenatori = [{ nome: "CHIVU", squadra: "Inter", qta: 30 }];
  expect(parseDataset(base).allenatori).toHaveLength(1);
  base.allenatori = [{ nome: "CHIVU" }]; // malformato
  expect(() => parseDataset(base)).toThrow(/allenatori/);
});
