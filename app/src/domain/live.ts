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
