import { useLeagues } from "../leagues";
import { useAuctions } from "../auctions";
import { useStrategy } from "../strategy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { miniDataset } from "../../domain/__tests__/fixtures";
import type { League, Player } from "../../domain/types";

// Il middleware persist scrive su AsyncStorage in modo "fire and forget"
// (la Promise di storage.setItem non è attesa dalle azioni dello store).
// Un giro di macrotask garantisce che tutti i microtask della catena di
// scrittura del mock siano stati drenati prima di leggere lo storage grezzo.
function flushMicrotasks() {
  return new Promise<void>(resolve => setTimeout(resolve, 0));
}

// NOTA: non possiamo simulare il "riavvio" con `useX.setState(vuoto)` seguito
// da `persist.rehydrate()`: col mock di AsyncStorage la scrittura innescata
// da quel `setState` è sincrona, quindi sovrascriverebbe lo storage con lo
// stato vuoto PRIMA che rehydrate() possa rileggere i dati corretti (verificato
// empiricamente). Creiamo quindi una VERA istanza fresca dello store — via
// `jest.resetModules()` + `require` — che legge dallo stesso storage mockato,
// riproducendo fedelmente un riavvio dell'app (zustand persist si idrata alla
// creazione dello store).
declare const require: (id: string) => unknown;

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

beforeEach(() => {
  useLeagues.setState({ leagues: [], activeLeagueId: null });
  useAuctions.setState({ byLeague: {} });
  useStrategy.setState({ byLeague: {} });
});

test("useLeagues: le mutazioni sopravvivono a una nuova istanza dello store (crash-safety)", async () => {
  const l = useLeagues.getState().createLeague({
    nome: "Persistita", teamNames: ["Io", "Avv1", "Avv2"], crediti: 300,
  });
  useLeagues.getState().updateLeague(l.id, { nome: "Rinominata" });
  await flushMicrotasks();

  const raw = await AsyncStorage.getItem("fanta-leagues");
  expect(raw).toBeTruthy();

  jest.resetModules();
  const freshAsyncStorage = require("@react-native-async-storage/async-storage") as {
    __INTERNAL_MOCK_STORAGE__: Record<string, string>;
  };
  freshAsyncStorage.__INTERNAL_MOCK_STORAGE__["fanta-leagues"] = raw!;
  const { useLeagues: freshUseLeagues } = require("../leagues") as { useLeagues: typeof useLeagues };
  await freshUseLeagues.persist.rehydrate();

  const restored = freshUseLeagues.getState().leagues.find(x => x.id === l.id);
  expect(restored).toBeDefined();
  expect(restored!.nome).toBe("Rinominata");
  expect(freshUseLeagues.getState().activeLeagueId).toBe(l.id);
});

test("useAuctions: gli acquisti sopravvivono a una nuova istanza dello store (crash-safety)", async () => {
  useAuctions.getState().purchase("L1", league(), byId,
    { playerId: att.id, teamId: "T1", prezzo: 30 });
  await flushMicrotasks();

  const raw = await AsyncStorage.getItem("fanta-auctions");
  expect(raw).toBeTruthy();

  jest.resetModules();
  const freshAsyncStorage = require("@react-native-async-storage/async-storage") as {
    __INTERNAL_MOCK_STORAGE__: Record<string, string>;
  };
  freshAsyncStorage.__INTERNAL_MOCK_STORAGE__["fanta-auctions"] = raw!;
  const { useAuctions: freshUseAuctions } = require("../auctions") as { useAuctions: typeof useAuctions };
  await freshUseAuctions.persist.rehydrate();

  const restored = freshUseAuctions.getState().getAuction("L1");
  expect(restored.purchases).toHaveLength(1);
  expect(restored.purchases[0]).toMatchObject({ playerId: att.id, teamId: "T1", prezzo: 30 });
});

test("useStrategy: alloc e target sopravvivono a una nuova istanza dello store (crash-safety)", async () => {
  useStrategy.getState().setAlloc("L1", { P: 50, D: 150, C: 150, A: 150 });
  useStrategy.getState().addTarget("L1", att.id, 42);
  await flushMicrotasks();

  const raw = await AsyncStorage.getItem("fanta-strategy");
  expect(raw).toBeTruthy();

  jest.resetModules();
  const freshAsyncStorage = require("@react-native-async-storage/async-storage") as {
    __INTERNAL_MOCK_STORAGE__: Record<string, string>;
  };
  freshAsyncStorage.__INTERNAL_MOCK_STORAGE__["fanta-strategy"] = raw!;
  const { useStrategy: freshUseStrategy } = require("../strategy") as { useStrategy: typeof useStrategy };
  await freshUseStrategy.persist.rehydrate();

  const restored = freshUseStrategy.getState().getStrategy("L1");
  expect(restored.alloc).toEqual({ P: 50, D: 150, C: 150, A: 150 });
  expect(restored.targets).toHaveLength(1);
  expect(restored.targets[0]).toMatchObject({ playerId: att.id, prezzo: 42 });
});
