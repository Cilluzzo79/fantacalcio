import type { League, Player, Ruolo } from "./types";
import { computeLeaguePrices } from "./prices";

const RUOLI: Ruolo[] = ["P", "D", "C", "A"];

export function suggestBudgetSplit(players: Player[],
  league: League): Record<Ruolo, number> {
  const creditiMedi = league.teams.reduce((a, t) => a + t.crediti, 0)
    / league.teams.length;
  const prices = computeLeaguePrices(players, {
    teams: league.teams.length, creditiPerTeam: creditiMedi,
    slots: league.slots });
  const budget = league.teams[league.myTeamIndex].crediti;
  const perRuolo: Record<Ruolo, number> = { P: 0, D: 0, C: 0, A: 0 };
  let tot = 0;
  for (const p of players) {
    const pr = prices.get(p.id)!;
    if (pr > 1) { perRuolo[p.ruolo] += pr; tot += pr; }
  }
  const out = {} as Record<Ruolo, number>;
  let assegnati = 0;
  for (const r of RUOLI) {
    out[r] = Math.max(league.slots[r],
      Math.round(budget * (tot > 0 ? perRuolo[r] / tot : 0.25)));
    assegnati += out[r];
  }
  // aggiusta l'arrotondamento sul reparto con l'allocazione più grande
  const maxR = RUOLI.reduce((a, r) => (out[r] > out[a] ? r : a), "D" as Ruolo);
  out[maxR] += budget - assegnati;
  return out;
}

export function targetWarnings(alloc: Record<Ruolo, number>,
  targets: { playerId: number; prezzo: number }[],
  players: Map<number, Player>): string[] {
  const spesa: Record<Ruolo, number> = { P: 0, D: 0, C: 0, A: 0 };
  for (const t of targets) {
    const p = players.get(t.playerId);
    if (p) spesa[p.ruolo] += t.prezzo;
  }
  return RUOLI.filter(r => spesa[r] > alloc[r])
    .map(r => `Target ${r}: ${spesa[r]} su ${alloc[r]} allocati`);
}
