import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { League, Ruolo, TeamConfig } from "../domain/types";
import { newId } from "../domain/ids";

export const MAX_LEAGUES = 5;
export const DEFAULT_SLOTS: Record<Ruolo, number> = { P: 3, D: 8, C: 8, A: 6 };

interface CreateInput {
  nome: string; teamNames: string[]; crediti: number;
  slots?: Record<Ruolo, number>; myTeamIndex?: number;
}

interface LeaguesState {
  leagues: League[];
  activeLeagueId: string | null;
  createLeague(input: CreateInput): League;
  updateLeague(id: string, patch: Partial<Pick<League, "nome" | "slots" | "myTeamIndex">>): void;
  setTeamRoster(leagueId: string, teamId: string,
    roster: { playerId: number; prezzo: number }[], creditiResidui: number): void;
  deleteLeague(id: string): void;
  setActiveLeague(id: string): void;
}

export const useLeagues = create<LeaguesState>()(
  persist(
    (set, get) => ({
      leagues: [],
      activeLeagueId: null,

      createLeague(input) {
        if (get().leagues.length >= MAX_LEAGUES) throw new Error("massimo 5 leghe");
        if (input.myTeamIndex !== undefined
          && (input.myTeamIndex < 0 || input.myTeamIndex >= input.teamNames.length)) {
          throw new Error("myTeamIndex non valido");
        }
        const teams: TeamConfig[] = input.teamNames.map(nome => ({
          id: newId(), nome, crediti: input.crediti, rosterIniziale: [],
        }));
        const league: League = {
          id: newId(), nome: input.nome, slots: input.slots ?? { ...DEFAULT_SLOTS },
          teams, myTeamIndex: input.myTeamIndex ?? 0,
          createdAt: new Date().toISOString(),
        };
        set(s => ({ leagues: [...s.leagues, league], activeLeagueId: league.id }));
        return league;
      },

      updateLeague(id, patch) {
        if (patch.myTeamIndex !== undefined) {
          const league = get().leagues.find(l => l.id === id);
          if (league
            && (patch.myTeamIndex < 0 || patch.myTeamIndex >= league.teams.length)) {
            throw new Error("myTeamIndex non valido");
          }
        }
        set(s => ({ leagues: s.leagues.map(l => (l.id === id ? { ...l, ...patch } : l)) }));
      },

      setTeamRoster(leagueId, teamId, roster, creditiResidui) {
        set(s => ({
          leagues: s.leagues.map(l => l.id !== leagueId ? l : {
            ...l,
            teams: l.teams.map(t => t.id !== teamId ? t
              : { ...t, rosterIniziale: roster, crediti: creditiResidui }),
          }),
        }));
      },

      deleteLeague(id) {
        set(s => ({
          leagues: s.leagues.filter(l => l.id !== id),
          activeLeagueId: s.activeLeagueId === id ? null : s.activeLeagueId,
        }));
      },

      setActiveLeague(id) { set({ activeLeagueId: id }); },
    }),
    { name: "fanta-leagues", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
