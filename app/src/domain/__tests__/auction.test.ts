import {
  emptyAuction, registerPurchase, undoLast, removePurchase, editPurchase,
  teamSummary, AuctionError,
} from "../auction";
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
const por = ds.players.find(p => p.nome === "PortiereTop")!;

test("registra un acquisto e aggiorna il riepilogo", () => {
  let st = emptyAuction("L1");
  st = registerPurchase(st, league(), byId, { playerId: att.id, teamId: "T1", prezzo: 60 });
  const sum = teamSummary(st, league(), byId, "T1");
  expect(sum.spesi).toBe(60);
  expect(sum.residui).toBe(40);
  expect(sum.slotLiberi.A).toBe(0);
  // 3 slot liberi restanti (P,D,C) -> maxOfferta = 40 - 2 = 38
  expect(sum.maxOfferta).toBe(38);
});

test("giocatore già venduto -> errore", () => {
  let st = emptyAuction("L1");
  st = registerPurchase(st, league(), byId, { playerId: att.id, teamId: "T1", prezzo: 10 });
  expect(() => registerPurchase(st, league(), byId, { playerId: att.id, teamId: "T2", prezzo: 5 }))
    .toThrow(/già acquistato/);
});

test("slot pieni -> errore", () => {
  let st = emptyAuction("L1");
  st = registerPurchase(st, league(), byId, { playerId: att.id, teamId: "T1", prezzo: 10 });
  expect(() => registerPurchase(st, league(), byId, { playerId: attLow.id, teamId: "T1", prezzo: 5 }))
    .toThrow(/slot A pieni/);
});

test("budget: deve restare 1 credito per ogni slot vuoto", () => {
  let st = emptyAuction("L1");
  // 4 slot vuoti, 100 crediti -> max offerta 97
  expect(() => registerPurchase(st, league(), byId, { playerId: att.id, teamId: "T1", prezzo: 98 }))
    .toThrow(AuctionError);
  st = registerPurchase(st, league(), byId, { playerId: att.id, teamId: "T1", prezzo: 97 });
  expect(teamSummary(st, league(), byId, "T1").residui).toBe(3);
});

test("undo e remove", () => {
  let st = emptyAuction("L1");
  st = registerPurchase(st, league(), byId, { playerId: att.id, teamId: "T1", prezzo: 10 });
  st = registerPurchase(st, league(), byId, { playerId: por.id, teamId: "T2", prezzo: 5 });
  st = undoLast(st);
  expect(st.purchases).toHaveLength(1);
  st = removePurchase(st, st.purchases[0].id);
  expect(st.purchases).toHaveLength(0);
});

test("edit re-valida (prezzo eccessivo rifiutato)", () => {
  let st = emptyAuction("L1");
  st = registerPurchase(st, league(), byId, { playerId: att.id, teamId: "T1", prezzo: 10 });
  expect(() => editPurchase(st, league(), byId, st.purchases[0].id, { prezzo: 98 }))
    .toThrow(AuctionError);
  st = editPurchase(st, league(), byId, st.purchases[0].id, { prezzo: 50 });
  expect(st.purchases[0].prezzo).toBe(50);
});

test("modalità riparazione: roster iniziale occupa slot", () => {
  const l = league();
  l.teams[0].rosterIniziale = [{ playerId: por.id, prezzo: 20 }];
  l.teams[0].crediti = 80; // residui
  const st = emptyAuction("L1");
  const sum = teamSummary(st, l, byId, "T1");
  expect(sum.slotLiberi.P).toBe(0);
  expect(sum.residui).toBe(80);
  expect(() => registerPurchase(st, l, byId, { playerId: ds.players[1].id, teamId: "T1", prezzo: 5 }))
    .toThrow(/slot P pieni/);
});
