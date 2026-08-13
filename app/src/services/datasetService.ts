import * as FileSystem from "expo-file-system/legacy";
import { parseDataset, DatasetError } from "../domain/dataset";
import type { Dataset } from "../domain/types";

export const DATASET_URL =
  "https://raw.githubusercontent.com/Cilluzzo79/fantacalcio/master/data/dataset.json";
const LOCAL_PATH = "dataset.json";
const STALE_DAYS = 30;

export interface Deps {
  fetchFn: typeof fetch;
  readFile(path: string): Promise<string | null>;
  writeFile(path: string, content: string): Promise<void>;
}

function defaultDeps(): Deps {
  const dir = FileSystem.documentDirectory ?? "";
  return {
    fetchFn: fetch,
    async readFile(path) {
      const info = await FileSystem.getInfoAsync(dir + path);
      if (!info.exists) return null;
      return FileSystem.readAsStringAsync(dir + path);
    },
    async writeFile(path, content) {
      await FileSystem.writeAsStringAsync(dir + path, content);
    },
  };
}

export async function loadLocalDataset(deps: Deps = defaultDeps()): Promise<Dataset | null> {
  const raw = await deps.readFile(LOCAL_PATH);
  if (raw === null) return null;
  try {
    return parseDataset(JSON.parse(raw));
  } catch {
    return null; // file corrotto: come se non ci fosse (verrà riscaricato)
  }
}

export async function refreshDataset(current: Dataset | null,
  deps: Deps = defaultDeps()): Promise<{ dataset: Dataset; updated: boolean }> {
  let remote: Dataset | null = null;
  try {
    const res = await deps.fetchFn(DATASET_URL);
    if (res.ok) remote = parseDataset(await res.json());
  } catch {
    remote = null; // offline o parse fallito: si prosegue col corrente
  }
  if (remote && (!current || remote.generatedAt > current.generatedAt)) {
    await deps.writeFile(LOCAL_PATH, JSON.stringify(remote));
    return { dataset: remote, updated: true };
  }
  if (current) return { dataset: current, updated: false };
  throw new DatasetError("nessun dataset disponibile: scarica o importa il file");
}

export async function importDatasetFromText(text: string,
  deps: Deps = defaultDeps()): Promise<Dataset> {
  const ds = parseDataset(JSON.parse(text));
  await deps.writeFile(LOCAL_PATH, JSON.stringify(ds));
  return ds;
}

export function isStale(ds: Dataset, nowIso: string): boolean {
  const ageMs = Date.parse(nowIso) - Date.parse(ds.generatedAt);
  return ageMs > STALE_DAYS * 24 * 3600 * 1000;
}
