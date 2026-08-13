import { useAuctions } from "../auctions";
import { miniDataset } from "../../domain/__tests__/fixtures";
import { AuctionError } from "../../domain/auction";
import type { League, Player } from "../../domain/types";

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

beforeEach(() => useAuctions.setState({ byLeague: {} }));

test("purchase registra e getAuction riflette lo stato", () => {
  useAuctions.getState().purchase("L1", league(), byId,
    { playerId: att.id, teamId: "T1", prezzo: 30 });
  expect(useAuctions.getState().getAuction("L1").purchases).toHaveLength(1);
});

test("aste di leghe diverse sono indipendenti", () => {
  useAuctions.getState().purchase("L1", league(), byId,
    { playerId: att.id, teamId: "T1", prezzo: 30 });
  expect(useAuctions.getState().getAuction("L2").purchases).toHaveLength(0);
});

test("gli errori di validazione si propagano senza corrompere lo stato", () => {
  const st = useAuctions.getState();
  expect(() => st.purchase("L1", league(), byId,
    { playerId: att.id, teamId: "T1", prezzo: 99 })).toThrow(AuctionError);
  expect(st.getAuction("L1").purchases).toHaveLength(0);
});

test("undo, remove e reset", () => {
  const st = useAuctions.getState();
  st.purchase("L1", league(), byId, { playerId: att.id, teamId: "T1", prezzo: 30 });
  st.undo("L1");
  expect(st.getAuction("L1").purchases).toHaveLength(0);
  st.purchase("L1", league(), byId, { playerId: att.id, teamId: "T1", prezzo: 30 });
  st.remove("L1", st.getAuction("L1").purchases[0].id);
  expect(st.getAuction("L1").purchases).toHaveLength(0);
  st.purchase("L1", league(), byId, { playerId: att.id, teamId: "T1", prezzo: 30 });
  st.resetAuction("L1");
  expect(st.getAuction("L1").purchases).toHaveLength(0);
});
