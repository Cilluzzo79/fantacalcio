import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuctionState, League, Player } from "../domain/types";
import {
  emptyAuction, registerPurchase, undoLast, removePurchase, editPurchase,
} from "../domain/auction";

interface AuctionsStore {
  byLeague: Record<string, AuctionState>;
  getAuction(leagueId: string): AuctionState;
  purchase(leagueId: string, league: League, players: Map<number, Player>,
    p: { playerId: number; teamId: string; prezzo: number }, opts?: { force?: boolean }): void;
  undo(leagueId: string): void;
  remove(leagueId: string, purchaseId: string): void;
  edit(leagueId: string, league: League, players: Map<number, Player>,
    purchaseId: string, patch: { teamId?: string; prezzo?: number },
    opts?: { force?: boolean }): void;
  resetAuction(leagueId: string): void;
}

// cache module-level: garantisce che getAuction ritorni SEMPRE lo stesso
// riferimento per una lega assente, indipendentemente da quante volte viene
// chiamata (utile per selettori/memo a valle che confrontano per identità).
const emptyAuctionCache = new Map<string, AuctionState>();
function getCachedEmptyAuction(leagueId: string): AuctionState {
  let a = emptyAuctionCache.get(leagueId);
  if (!a) {
    a = emptyAuction(leagueId);
    emptyAuctionCache.set(leagueId, a);
  }
  return a;
}

export const useAuctions = create<AuctionsStore>()(
  persist(
    (set, get) => ({
      byLeague: {},

      getAuction(leagueId) {
        return get().byLeague[leagueId] ?? getCachedEmptyAuction(leagueId);
      },
      purchase(leagueId, league, players, p, opts) {
        const next = registerPurchase(get().getAuction(leagueId), league, players, p, opts);
        set(s => ({ byLeague: { ...s.byLeague, [leagueId]: next } }));
      },
      undo(leagueId) {
        const next = undoLast(get().getAuction(leagueId));
        set(s => ({ byLeague: { ...s.byLeague, [leagueId]: next } }));
      },
      remove(leagueId, purchaseId) {
        const next = removePurchase(get().getAuction(leagueId), purchaseId);
        set(s => ({ byLeague: { ...s.byLeague, [leagueId]: next } }));
      },
      edit(leagueId, league, players, purchaseId, patch, opts) {
        const next = editPurchase(get().getAuction(leagueId), league, players,
          purchaseId, patch, opts);
        set(s => ({ byLeague: { ...s.byLeague, [leagueId]: next } }));
      },
      resetAuction(leagueId) {
        set(s => {
          const byLeague = { ...s.byLeague };
          delete byLeague[leagueId];
          return { byLeague };
        });
      },
    }),
    { name: "fanta-auctions", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
