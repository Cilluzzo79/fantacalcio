import { emptyAuction, teamSummary } from "../auction";
import { registerCoach, removeCoach, coachOf, maxCoachOfferta } from "../coach";
import { miniDataset } from "./fixtures";
import type { League } from "../types";

const players = new Map(miniDataset().players.map(p => [p.id, p]));

function mkLeague(useCoaches = true): League {
  return {
    id: "L1", nome: "Test", slots: { P: 1, D: 1, C: 1, A: 1 },
    teams: [
      { id: "t1", nome: "Io", crediti: 50, rosterIniziale: [] },
      { id: "t2", nome: "Avv", crediti: 50, rosterIniziale: [] },
    ],
    myTeamIndex: 0, createdAt: "2026-08-14T00:00:00Z", useCoaches,
  };
}
const chivu = { teamId: "t1", nome: "CHIVU", squadra: "Inter", prezzo: 20 };

test("registerCoach felice: spesa contata nel summary, needCoach si spegne", () => {
  const league = mkLeague();
  let state = emptyAuction("L1");
  expect(teamSummary(state, league, players, "t1").needCoach).toBe(true);
  state = registerCoach(state, league, players, chivu);
  expect(coachOf(state, "t1")?.nome).toBe("CHIVU");
  const sum = teamSummary(state, league, players, "t1");
  expect(sum.coachSpesa).toBe(20);
  expect(sum.residui).toBe(30);
  expect(sum.needCoach).toBe(false);
});

test("lega senza allenatori: registerCoach rifiuta e il summary non riserva nulla", () => {
  const league = mkLeague(false);
  expect(() => registerCoach(emptyAuction("L1"), league, players, chivu))
    .toThrow(/non usa gli allenatori/);
  expect(teamSummary(emptyAuction("L1"), league, players, "t1").needCoach)
    .toBe(false);
});

test("un allenatore per squadra, niente doppioni tra squadre", () => {
  const league = mkLeague();
  let state = registerCoach(emptyAuction("L1"), league, players, chivu);
  expect(() => registerCoach(state, league, players,
    { teamId: "t1", nome: "ALLEGRI", squadra: "Napoli", prezzo: 5 }))
    .toThrow(/ha già un allenatore/);
  expect(() => registerCoach(state, league, players,
    { teamId: "t2", nome: "CHIVU", squadra: "Inter", prezzo: 5 }))
    .toThrow(/già acquistato/);
  state = removeCoach(state, state.coaches![0].id);
  expect(coachOf(state, "t1")).toBeUndefined();
});

test("budget: maxCoachOfferta riserva 1 credito per ogni slot giocatore vuoto", () => {
  const league = mkLeague();
  const state = emptyAuction("L1");
  // 50 crediti, 4 slot giocatore vuoti -> max allenatore 46
  expect(maxCoachOfferta(state, league, players, "t1")).toBe(46);
  expect(() => registerCoach(state, league, players, { ...chivu, prezzo: 47 }))
    .toThrow(/crediti/);
  // force scavalca
  const forced = registerCoach(state, league, players,
    { ...chivu, prezzo: 47 }, { force: true });
  expect(forced.coaches).toHaveLength(1);
});

test("la riserva allenatore abbassa maxOfferta giocatori di 1", () => {
  const conCoach = teamSummary(emptyAuction("L1"), mkLeague(true), players, "t1");
  const senza = teamSummary(emptyAuction("L1"), mkLeague(false), players, "t1");
  expect(senza.maxOfferta - conCoach.maxOfferta).toBe(1);
});
