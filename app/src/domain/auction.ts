import type { AuctionState, League, Player, Purchase, Ruolo } from "./types";
import { newId } from "./ids";

export class AuctionError extends Error {}

const RUOLI: Ruolo[] = ["P", "D", "C", "A"];

export function emptyAuction(leagueId: string): AuctionState {
  return { leagueId, purchases: [] };
}

export function teamSummary(state: AuctionState, league: League,
  players: Map<number, Player>, teamId: string) {
  const team = league.teams.find(t => t.id === teamId);
  if (!team) throw new AuctionError("squadra sconosciuta");
  const acquisti = state.purchases.filter(p => p.teamId === teamId);
  const spesi = acquisti.reduce((a, p) => a + p.prezzo, 0);
  const coachSpesa = (state.coaches ?? [])
    .filter(c => c.teamId === teamId).reduce((a, c) => a + c.prezzo, 0);
  const residui = team.crediti - spesi - coachSpesa;
  const slotLiberi = {} as Record<Ruolo, number>;
  for (const r of RUOLI) {
    const iniziali = team.rosterIniziale
      .filter(x => players.get(x.playerId)?.ruolo === r).length;
    const comprati = acquisti.filter(p => players.get(p.playerId)?.ruolo === r).length;
    slotLiberi[r] = league.slots[r] - iniziali - comprati;
  }
  const slotTot = RUOLI.reduce((a, r) => a + slotLiberi[r], 0);
  const needCoach = league.useCoaches === true
    && !(state.coaches ?? []).some(c => c.teamId === teamId);
  const maxOfferta = Math.max(0,
    residui - Math.max(0, slotTot + (needCoach ? 1 : 0) - 1));
  const rosa = [
    ...team.rosterIniziale,
    ...acquisti.map(p => ({ playerId: p.playerId, prezzo: p.prezzo })),
  ];
  return { spesi, residui, slotLiberi, maxOfferta, rosa, coachSpesa, needCoach };
}

export function registerPurchase(state: AuctionState, league: League,
  players: Map<number, Player>,
  p: { playerId: number; teamId: string; prezzo: number },
  opts?: { force?: boolean }): AuctionState {
  const player = players.get(p.playerId);
  if (!player) throw new AuctionError("giocatore sconosciuto");
  const giaVenduto = state.purchases.some(x => x.playerId === p.playerId)
    || league.teams.some(t => t.rosterIniziale.some(x => x.playerId === p.playerId));
  if (giaVenduto) throw new AuctionError("giocatore già acquistato");
  if (p.prezzo < 1) throw new AuctionError("prezzo minimo 1");
  const sum = teamSummary(state, league, players, p.teamId);
  if (!opts?.force) {
    if (sum.slotLiberi[player.ruolo] <= 0)
      throw new AuctionError(`slot ${player.ruolo} pieni`);
    if (p.prezzo > sum.maxOfferta)
      throw new AuctionError(`budget insufficiente: restano ${sum.maxOfferta} crediti utilizzabili`);
  }
  const purchase: Purchase = { id: newId(), ...p, ts: new Date().toISOString() };
  return { ...state, purchases: [...state.purchases, purchase] };
}

export function undoLast(state: AuctionState): AuctionState {
  return { ...state, purchases: state.purchases.slice(0, -1) };
}

export function removePurchase(state: AuctionState, purchaseId: string): AuctionState {
  return { ...state, purchases: state.purchases.filter(p => p.id !== purchaseId) };
}

export function editPurchase(state: AuctionState, league: League,
  players: Map<number, Player>, purchaseId: string,
  patch: { teamId?: string; prezzo?: number },
  opts?: { force?: boolean }): AuctionState {
  const orig = state.purchases.find(p => p.id === purchaseId);
  if (!orig) throw new AuctionError("acquisto inesistente");
  const without = removePurchase(state, purchaseId);
  const reregistered = registerPurchase(without, league, players, {
    playerId: orig.playerId,
    teamId: patch.teamId ?? orig.teamId,
    prezzo: patch.prezzo ?? orig.prezzo,
  }, opts);
  // mantieni id/ts originali e l'ordine originale: reinserisci nella stessa posizione
  const nuovo: Purchase = {
    ...reregistered.purchases[reregistered.purchases.length - 1],
    id: orig.id, ts: orig.ts,
  };
  const idx = state.purchases.findIndex(p => p.id === purchaseId);
  const purchases = [...without.purchases];
  purchases.splice(idx, 0, nuovo);
  return { ...state, purchases };
}
