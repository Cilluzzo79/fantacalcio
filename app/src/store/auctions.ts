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
    p: { playerId: number; teamId: string; prezzo: number }): void;
  undo(leagueId: string): void;
  remove(leagueId: string, purchaseId: string): void;
  edit(leagueId: string, league: League, players: Map<number, Player>,
    purchaseId: string, patch: { teamId?: string; prezzo?: number }): void;
  resetAuction(leagueId: string): void;
}

export const useAuctions = create<AuctionsStore>()(
  persist(
    (set, get) => ({
      byLeague: {},

      getAuction(leagueId) {
        return get().byLeague[leagueId] ?? emptyAuction(leagueId);
      },
      purchase(leagueId, league, players, p) {
        const next = registerPurchase(get().getAuction(leagueId), league, players, p);
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
      edit(leagueId, league, players, purchaseId, patch) {
        const next = editPurchase(get().getAuction(leagueId), league, players, purchaseId, patch);
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
