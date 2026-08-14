import {
  loadLocalDataset, refreshDataset, importDatasetFromText, isStale,
} from "../datasetService";
import { miniDataset } from "../../domain/__tests__/fixtures";

function fakeDeps(files: Record<string, string> = {}, remote?: object | Error) {
  return {
    files,
    deps: {
      fetchFn: (async () => {
        if (remote instanceof Error) throw remote;
        if (!remote) return { ok: false, status: 404 } as Response;
        return { ok: true, status: 200, json: async () => remote } as unknown as Response;
      }) as typeof fetch,
      readFile: async (p: string) => files[p] ?? null,
      writeFile: async (p: string, c: string) => { files[p] = c; },
    },
  };
}

test("loadLocalDataset: null senza file, dataset col file", async () => {
  const { deps } = fakeDeps();
  expect(await loadLocalDataset(deps)).toBeNull();
  const withFile = fakeDeps({ "dataset.json": JSON.stringify(miniDataset()) });
  expect((await loadLocalDataset(withFile.deps))!.players).toHaveLength(9);
});

test("refreshDataset scarica e salva se più recente", async () => {
  const vecchio = { ...miniDataset(), generatedAt: "2026-08-01T00:00:00+00:00" };
  const nuovo = { ...miniDataset(), generatedAt: "2026-08-13T00:00:00+00:00" };
  const { files, deps } = fakeDeps({}, nuovo);
  const res = await refreshDataset(vecchio, deps);
  expect(res.updated).toBe(true);
  expect(res.dataset.generatedAt).toBe(nuovo.generatedAt);
  expect(files["dataset.json"]).toContain(nuovo.generatedAt);
});

test("refreshDataset ignora un remoto più vecchio", async () => {
  const corrente = { ...miniDataset(), generatedAt: "2026-08-13T00:00:00+00:00" };
  const remoto = { ...miniDataset(), generatedAt: "2026-08-01T00:00:00+00:00" };
  const { deps } = fakeDeps({}, remoto);
  const res = await refreshDataset(corrente, deps);
  expect(res.updated).toBe(false);
  expect(res.dataset.generatedAt).toBe(corrente.generatedAt);
});

test("offline: ritorna il corrente senza errori", async () => {
  const corrente = miniDataset();
  const { deps } = fakeDeps({}, new Error("network down"));
  const res = await refreshDataset(corrente, deps);
  expect(res.updated).toBe(false);
  expect(res.dataset).toBe(corrente);
});

test("offline e nessun corrente -> DatasetError", async () => {
  const { deps } = fakeDeps({}, new Error("network down"));
  await expect(refreshDataset(null, deps)).rejects.toThrow(/dataset/i);
});

test("import da testo: valida e salva", async () => {
  const { files, deps } = fakeDeps();
  const ds = await importDatasetFromText(JSON.stringify(miniDataset()), deps);
  expect(ds.players).toHaveLength(9);
  expect(files["dataset.json"]).toBeTruthy();
  await expect(importDatasetFromText("{}", deps)).rejects.toThrow();
});

test("isStale a 30 giorni", () => {
  const ds = { ...miniDataset(), generatedAt: "2026-07-01T00:00:00+00:00" };
  expect(isStale(ds, "2026-08-13T00:00:00+00:00")).toBe(true);
  expect(isStale(ds, "2026-07-15T00:00:00+00:00")).toBe(false);
});
