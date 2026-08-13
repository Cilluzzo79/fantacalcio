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
