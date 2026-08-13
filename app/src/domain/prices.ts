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
