import { useDataset } from "../dataset";
import { useAuctions } from "../auctions";
import { miniDataset } from "../../domain/__tests__/fixtures";
import type { Deps } from "../../services/datasetService";

function fakeDeps(opts: {
  local?: object | Error;
  remote?: object | Error | null; // null = 404, undefined = mai chiamato/ok ma nulla
} = {}): Deps {
  return {
    fetchFn: (async () => {
      if (opts.remote instanceof Error) throw opts.remote;
      if (!opts.remote) return { ok: false, status: 404 } as Response;
      return { ok: true, status: 200, json: async () => opts.remote } as unknown as Response;
    }) as typeof fetch,
    readFile: async () => {
      if (opts.local instanceof Error) throw opts.local;
      return opts.local ? JSON.stringify(opts.local) : null;
    },
    writeFile: async () => {},
  };
}

beforeEach(() => {
  useDataset.setState({ dataset: null, status: "loading" });
  useAuctions.setState({ byLeague: {} });
});

test("boot con deps funzionanti -> ready", async () => {
  const deps = fakeDeps({ local: miniDataset() });
  await useDataset.getState().boot(deps);
  expect(useDataset.getState().status).toBe("ready");
  expect(useDataset.getState().dataset).not.toBeNull();
});

test("boot: lettura locale rifiutata e rete fallita -> missing (non resta bloccato su loading)", async () => {
  const deps = fakeDeps({ local: new Error("fs down"), remote: new Error("network down") });
  await useDataset.getState().boot(deps);
  expect(useDataset.getState().status).toBe("missing");
});

test("refresh fallito senza dataset presente -> missing", async () => {
  const deps = fakeDeps({ remote: new Error("network down") });
  const ok = await useDataset.getState().refresh(deps);
  expect(ok).toBe(false);
  expect(useDataset.getState().status).toBe("missing");
});

test("asta in corso: boot non richiama il refresh remoto e resta sul dataset locale", async () => {
  useAuctions.setState({
    byLeague: {
      L1: {
        leagueId: "L1",
        purchases: [{ id: "p1", playerId: 1, teamId: "T1", prezzo: 10, ts: "2026-08-13T00:00:00Z" }],
      },
    },
  });
  const fetchSpy = jest.fn(async () => { throw new Error("fetchFn non doveva essere chiamato"); });
  const deps = fakeDeps({ local: miniDataset() });
  deps.fetchFn = fetchSpy as unknown as typeof fetch;

  await useDataset.getState().boot(deps);

  expect(fetchSpy).not.toHaveBeenCalled();
  expect(useDataset.getState().status).toBe("ready");
  expect(useDataset.getState().dataset).not.toBeNull();
});

test("asta in corso e nessun dataset locale -> missing, senza chiamare la rete", async () => {
  useAuctions.setState({
    byLeague: {
      L1: {
        leagueId: "L1",
        purchases: [{ id: "p1", playerId: 1, teamId: "T1", prezzo: 10, ts: "2026-08-13T00:00:00Z" }],
      },
    },
  });
  const fetchSpy = jest.fn(async () => { throw new Error("fetchFn non doveva essere chiamato"); });
  const deps = fakeDeps({});
  deps.fetchFn = fetchSpy as unknown as typeof fetch;

  await useDataset.getState().boot(deps);

  expect(fetchSpy).not.toHaveBeenCalled();
  expect(useDataset.getState().status).toBe("missing");
});
