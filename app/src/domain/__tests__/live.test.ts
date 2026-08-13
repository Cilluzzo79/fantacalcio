import { computeLive } from "../live";
import { emptyAuction, registerPurchase } from "../auction";
import { miniDataset } from "./fixtures";
import type { League, Player } from "../types";

function league(): League {
  return {
    id: "L1", nome: "Test", slots: { P: 1, D: 1, C: 1, A: 1 },
    teams: [
      { id: "T1", nome: "Io", crediti: 100, rosterIniziale: [] },
      { id: "T2", nome: "Avv", crediti: 100, rosterIniziale: [] },
    ],
    myTeamIndex: 0, createdAt: "2026-08-13",
  };
}
const ds = miniDataset();
const byId = new Map<number, Player>(ds.players.map(p => [p.id, p]));
const att = ds.players.find(p => p.nome === "AttTop")!;
const attLow = ds.players.find(p => p.nome === "AttLow")!;
const cen = ds.players.find(p => p.nome === "CenTop")!;

test("senza acquisti, equoLive ~ equo base", () => {
  const live = computeLive(ds.players, league(), emptyAuction("L1"));
  const advice = live.bidAdvice(att.id);
  expect(advice.equoLive).toBeGreaterThan(1);
  expect(advice.mioMax).toBe(97); // 100 - (4-1)
  expect(advice.avversari[0].max).toBe(97);
});

test("se la lega strapaga, i prezzi live dei rimanenti scendono", () => {
  const l = league();
  let st = emptyAuction("L1");
  // T2 strapaga AttTop: 90 crediti
  st = registerPurchase(st, l, byId, { playerId: att.id, teamId: "T2", prezzo: 90 });
  const live = computeLive(ds.players, l, st);
  const base = computeLive(ds.players, l, emptyAuction("L1"));
  expect(live.bidAdvice(cen.id).equoLive).toBeLessThan(base.bidAdvice(cen.id).equoLive);
});

test("venduto un top di ruolo, il rimanente di fascia alta vale di più (scarsità)", () => {
  const l = league();
  let st = emptyAuction("L1");
  st = registerPurchase(st, l, byId, { playerId: att.id, teamId: "T2", prezzo: 10 });
  const live = computeLive(ds.players, l, st);
  // ruolo A: topAvail=0 (AttTop venduto, AttLow è "scommessa"), slotsNeeded=1 -> scarcity 1.2
  expect(live.scarcity.A).toBeCloseTo(1.2, 5);
});

test("slot del ruolo pieni -> mioMax 0", () => {
  const l = league();
  let st = emptyAuction("L1");
  st = registerPurchase(st, l, byId, { playerId: att.id, teamId: "T1", prezzo: 10 });
  const live = computeLive(ds.players, l, st);
  expect(live.bidAdvice(attLow.id).mioMax).toBe(0);
});

test("maxConsigliato non supera mai mioMax", () => {
  const l = league();
  l.teams[0].crediti = 10; // budget minuscolo
  const live = computeLive(ds.players, l, emptyAuction("L1"));
  const advice = live.bidAdvice(att.id);
  expect(advice.maxConsigliato).toBeLessThanOrEqual(advice.mioMax);
});
