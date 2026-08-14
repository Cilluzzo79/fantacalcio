import type { AuctionState, CoachPurchase, League, Player } from "./types";
import { AuctionError, teamSummary } from "./auction";
import { newId } from "./ids";

export function coachOf(state: AuctionState, teamId: string):
  CoachPurchase | undefined {
  return (state.coaches ?? []).find(c => c.teamId === teamId);
}

export function maxCoachOfferta(state: AuctionState, league: League,
  players: Map<number, Player>, teamId: string): number {
  const sum = teamSummary(state, league, players, teamId);
  const slotVuoti = (["P", "D", "C", "A"] as const)
    .reduce((a, r) => a + Math.max(0, sum.slotLiberi[r]), 0);
  return Math.max(0, sum.residui - slotVuoti);
}

export function registerCoach(state: AuctionState, league: League,
  players: Map<number, Player>,
  c: { teamId: string; nome: string; squadra: string; prezzo: number },
  opts?: { force?: boolean }): AuctionState {
  if (league.useCoaches !== true)
    throw new AuctionError("questa lega non usa gli allenatori");
  if (coachOf(state, c.teamId))
    throw new AuctionError("la squadra ha già un allenatore");
  if ((state.coaches ?? []).some(x => x.nome === c.nome && x.squadra === c.squadra))
    throw new AuctionError("allenatore già acquistato");
  if (c.prezzo < 1) throw new AuctionError("prezzo minimo 1");
  if (!opts?.force && c.prezzo > maxCoachOfferta(state, league, players, c.teamId))
    throw new AuctionError("crediti insufficienti per l'allenatore");
  const purchase: CoachPurchase = {
    id: newId(), ...c, ts: new Date().toISOString(),
  };
  return { ...state, coaches: [...(state.coaches ?? []), purchase] };
}

export function removeCoach(state: AuctionState, coachId: string): AuctionState {
  return { ...state, coaches: (state.coaches ?? []).filter(c => c.id !== coachId) };
}
