import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Ruolo } from "../domain/types";

export interface Target { playerId: number; prezzo: number; }

export interface LeagueStrategy {
  alloc: Record<Ruolo, number> | null;
  targets: Target[];
}

interface StrategyStore {
  byLeague: Record<string, LeagueStrategy>;
  getStrategy(leagueId: string): LeagueStrategy;
  setAlloc(leagueId: string, alloc: Record<Ruolo, number>): void;
  addTarget(leagueId: string, playerId: number, prezzo: number): void;
  setTargetPrice(leagueId: string, playerId: number, prezzo: number): void;
  removeTarget(leagueId: string, playerId: number): void;
}

// cache module-level: garantisce che getStrategy ritorni SEMPRE lo stesso
// riferimento per una lega assente, indipendentemente da quante volte viene
// chiamata (utile per selettori/memo a valle che confrontano per identità).
const emptyStrategyCache = new Map<string, LeagueStrategy>();
function getCachedEmptyStrategy(leagueId: string): LeagueStrategy {
  let s = emptyStrategyCache.get(leagueId);
  if (!s) {
    s = { alloc: null, targets: [] };
    emptyStrategyCache.set(leagueId, s);
  }
  return s;
}

export const useStrategy = create<StrategyStore>()(
  persist(
    (set, get) => ({
      byLeague: {},

      getStrategy(leagueId) {
        return get().byLeague[leagueId] ?? getCachedEmptyStrategy(leagueId);
      },
      setAlloc(leagueId, alloc) {
        set(s => ({
          byLeague: {
            ...s.byLeague,
            [leagueId]: { ...s.getStrategy(leagueId), alloc },
          },
        }));
      },
      addTarget(leagueId, playerId, prezzo) {
        set(s => {
          const cur = s.getStrategy(leagueId);
          if (cur.targets.some(t => t.playerId === playerId)) return s;
          return {
            byLeague: {
              ...s.byLeague,
              [leagueId]: { ...cur, targets: [...cur.targets, { playerId, prezzo }] },
            },
          };
        });
      },
      setTargetPrice(leagueId, playerId, prezzo) {
        set(s => {
          const cur = s.getStrategy(leagueId);
          return {
            byLeague: {
              ...s.byLeague,
              [leagueId]: {
                ...cur,
                targets: cur.targets.map(t => t.playerId === playerId ? { ...t, prezzo } : t),
              },
            },
          };
        });
      },
      removeTarget(leagueId, playerId) {
        set(s => {
          const cur = s.getStrategy(leagueId);
          return {
            byLeague: {
              ...s.byLeague,
              [leagueId]: { ...cur, targets: cur.targets.filter(t => t.playerId !== playerId) },
            },
          };
        });
      },
    }),
    { name: "fanta-strategy", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
