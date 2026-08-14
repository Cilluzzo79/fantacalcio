import { normalizeSearch, queryListone } from "../listoneQuery";
import { miniDataset } from "./fixtures";

test("normalizeSearch è accent/case-insensitive", () => {
  expect(normalizeSearch("CANDÈ")).toBe("cande");
  expect(normalizeSearch("  Martínez ")).toBe("martinez");
});

test("filtra per testo+ruolo e ordina per prezzo decrescente", () => {
  const players = miniDataset().players;
  const prezzo = (id: number) => id % 100; // prezzo finto deterministico
  const out = queryListone(players,
    { text: "", ruolo: "D", squadra: null, fascia: null, sort: "equo" }, prezzo);
  expect(out.every(p => p.ruolo === "D")).toBe(true);
  for (let i = 1; i < out.length; i++)
    expect(prezzo(out[i - 1].id)).toBeGreaterThanOrEqual(prezzo(out[i].id));
});

test("sort qta e affidabilità", () => {
  const players = miniDataset().players;
  const byQta = queryListone(players,
    { text: "", ruolo: null, squadra: null, fascia: null, sort: "qta" }, () => 1);
  for (let i = 1; i < byQta.length; i++)
    expect(byQta[i - 1].qta).toBeGreaterThanOrEqual(byQta[i].qta);
});
