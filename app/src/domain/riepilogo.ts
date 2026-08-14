import type { AuctionState, League, Player, Ruolo } from "./types";
import { teamSummary } from "./auction";
import type { LiveContext } from "./live";

const RUOLI: Ruolo[] = ["P", "D", "C", "A"];

export interface DealRow {
  playerId: number; nome: string; ruolo: Ruolo;
  prezzo: number; equo: number; delta: number;
}

export function buildRiepilogo(league: League, auction: AuctionState,
  players: Map<number, Player>, live: LiveContext) {
  const my = league.teams[league.myTeamIndex];
  const sum = teamSummary(auction, league, players, my.id);
  const rows: DealRow[] = sum.rosa.map(({ playerId, prezzo }) => {
    const pl = players.get(playerId);
    const equo = live.adjustedPrice(playerId);
    return { playerId, nome: pl?.nome ?? "?", ruolo: pl?.ruolo ?? "A",
      prezzo, equo, delta: prezzo - equo };
  });
  const rosa: Record<Ruolo, DealRow[]> = { P: [], D: [], C: [], A: [] };
  const spesaPerRuolo: Record<Ruolo, number> = { P: 0, D: 0, C: 0, A: 0 };
  for (const r of rows) { rosa[r.ruolo].push(r); spesaPerRuolo[r.ruolo] += r.prezzo; }
  const byDelta = [...rows].sort((a, b) => a.delta - b.delta);
  return {
    rosa, spesaPerRuolo,
    spesaTotale: RUOLI.reduce((a, r) => a + spesaPerRuolo[r], 0),
    residui: sum.residui,
    affari: byDelta.slice(0, 3).filter(r => r.delta < 0),
    strapagati: byDelta.slice(-3).reverse().filter(r => r.delta > 0),
  };
}
