import { create } from "zustand";
import type { Dataset } from "../domain/types";
import { loadLocalDataset, refreshDataset } from "../services/datasetService";

interface DatasetStore {
  dataset: Dataset | null;
  status: "loading" | "ready" | "missing";
  boot(): Promise<void>;
  refresh(): Promise<boolean>;
}

export const useDataset = create<DatasetStore>()((set, get) => ({
  dataset: null,
  status: "loading",
  async boot() {
    const local = await loadLocalDataset();
    if (local) set({ dataset: local, status: "ready" });
    try {
      const { dataset, updated } = await refreshDataset(local);
      set({ dataset, status: "ready" });
      void updated;
    } catch {
      if (!get().dataset) set({ status: "missing" });
    }
  },
  async refresh() {
    const { dataset } = get();
    try {
      const res = await refreshDataset(dataset);
      set({ dataset: res.dataset, status: "ready" });
      return res.updated;
    } catch {
      return false;
    }
  },
}));
