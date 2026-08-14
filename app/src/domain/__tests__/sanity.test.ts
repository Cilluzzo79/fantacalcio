import { computeLeaguePrices, replacementLevels } from "../prices";
import { miniDataset } from "./fixtures";

test("l'extra-monte finisce tutto e solo sui giocatori con vorp>0", () => {
  const players = miniDataset().players;
  const params = { teams: 8, creditiPerTeam: 500,
    slots: { P: 3, D: 8, C: 8, A: 6 } as const };
  const prices = computeLeaguePrices(players, params);
  const repl = replacementLevels(players, params);
  const conVorp = players.filter(p => p.valueScore - repl[p.ruolo] > 0);
  const extraDistribuito = conVorp
    .reduce((a, p) => a + (prices.get(p.id)! - 1), 0);
  const monte = params.teams * params.creditiPerTeam;
  const minSpend = params.teams * (3 + 8 + 8 + 6);
  // identità: Σ(prezzo-1) sui vorp>0 == monte - minSpend, a meno di arrotondamenti
  expect(Math.abs(extraDistribuito - (monte - minSpend)))
    .toBeLessThanOrEqual(Math.max(1, conVorp.length * 0.5));
  // e chi non ha vorp vale esattamente 1
  for (const p of players) {
    if (p.valueScore - repl[p.ruolo] <= 0) expect(prices.get(p.id)).toBe(1);
  }
});
