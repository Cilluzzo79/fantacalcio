import { buildRiepilogo } from "../riepilogo";
import { emptyAuction, registerPurchase } from "../auction";
import { computeLive } from "../live";
import { miniDataset } from "./fixtures";
import type { League } from "../types";

test("rosa per ruolo, spesa e classifica affari/strapagati", () => {
  const players = new Map(miniDataset().players.map(p => [p.id, p]));
  const league: League = {
    id: "L1", nome: "T", slots: { P: 1, D: 2, C: 2, A: 1 },
    teams: [
      { id: "t1", nome: "Io", crediti: 100, rosterIniziale: [] },
      { id: "t2", nome: "A", crediti: 100, rosterIniziale: [] },
    ], myTeamIndex: 0, createdAt: "2026-08-14T00:00:00Z",
  };
  const [d1, d2] = [...players.values()].filter(p => p.ruolo === "D");
  let auction = emptyAuction("L1");
  auction = registerPurchase(auction, league, players,
    { playerId: d1.id, teamId: "t1", prezzo: 1 });
  auction = registerPurchase(auction, league, players,
    { playerId: d2.id, teamId: "t1", prezzo: 60 });
  const live = computeLive([...players.values()], league, auction);
  const out = buildRiepilogo(league, auction, players, live);
  expect(out.rosa.D).toHaveLength(2);
  expect(out.spesaPerRuolo.D).toBe(61);
  expect(out.spesaTotale).toBe(61);
  // il pagato 60 con equo basso deve stare tra gli strapagati
  expect(out.strapagati.some(r => r.playerId === d2.id)).toBe(true);
});
