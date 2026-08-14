import { suggestBudgetSplit, targetWarnings } from "../strategy";
import { miniDataset } from "./fixtures";
import type { League } from "../types";

const league: League = {
  id: "L1", nome: "Test", slots: { P: 3, D: 8, C: 8, A: 6 },
  teams: [
    { id: "t1", nome: "Io", crediti: 500, rosterIniziale: [] },
    { id: "t2", nome: "A", crediti: 500, rosterIniziale: [] },
  ],
  myTeamIndex: 0, createdAt: "2026-08-14T00:00:00Z",
};

test("il suggerimento somma esattamente al budget e rispetta i minimi", () => {
  const out = suggestBudgetSplit(miniDataset().players, league);
  expect(out.P + out.D + out.C + out.A).toBe(500);
  (["P", "D", "C", "A"] as const)
    .forEach(r => expect(out[r]).toBeGreaterThanOrEqual(league.slots[r]));
});

test("targetWarnings segnala il ruolo che sfora", () => {
  const players = new Map(miniDataset().players.map(p => [p.id, p]));
  const unA = [...players.values()].find(p => p.ruolo === "A")!;
  const warns = targetWarnings({ P: 50, D: 100, C: 150, A: 10 },
    [{ playerId: unA.id, prezzo: 99 }], players);
  expect(warns.some(w => w.includes("A"))).toBe(true);
});
