import { validateRosterIniziale } from "../roster";
import { miniDataset } from "./fixtures";
import type { League } from "../types";

const players = new Map(miniDataset().players.map(p => [p.id, p]));
const pByRole = (r: string) =>
  [...players.values()].filter(p => p.ruolo === r).map(p => p.id);

function mkLeague(): League {
  return {
    id: "L1", nome: "Test", slots: { P: 1, D: 2, C: 2, A: 1 },
    teams: [
      { id: "t1", nome: "Io", crediti: 100, rosterIniziale: [] },
      { id: "t2", nome: "Avv", crediti: 100, rosterIniziale: [] },
    ],
    myTeamIndex: 0, createdAt: "2026-08-14T00:00:00Z",
  };
}

test("roster valido: nessun problema", () => {
  const [d1] = pByRole("D");
  const out = validateRosterIniziale({
    league: mkLeague(), players, teamId: "t1",
    roster: [{ playerId: d1, prezzo: 10 }],
    creditiResidui: 50, takenElsewhere: new Set(),
  });
  expect(out).toEqual([]);
});

test("over-allocazione di ruolo segnalata", () => {
  const [d1, d2, d3] = pByRole("D");
  const out = validateRosterIniziale({
    league: mkLeague(), players, teamId: "t1",
    roster: [d1, d2, d3].map(id => ({ playerId: id, prezzo: 1 })),
    creditiResidui: 50, takenElsewhere: new Set(),
  });
  expect(out.some(p => p.includes("D"))).toBe(true); // 3 D su slot 2
});

test("giocatore già preso da un'altra squadra, duplicati e residui insufficienti", () => {
  const [d1] = pByRole("D");
  const league = mkLeague();
  const out = validateRosterIniziale({
    league, players, teamId: "t1",
    roster: [{ playerId: d1, prezzo: 10 }, { playerId: d1, prezzo: 5 }],
    creditiResidui: 2, takenElsewhere: new Set([d1]),
  });
  expect(out.some(p => p.includes("duplicat"))).toBe(true);
  expect(out.some(p => p.includes("altra squadra"))).toBe(true);
  // slot liberi = 6 totali - 2 occupati... residui 2 < slot vuoti rimanenti
  expect(out.some(p => p.includes("crediti"))).toBe(true);
});
