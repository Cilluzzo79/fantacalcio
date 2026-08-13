import { create } from "zustand";
import type { Dataset } from "../domain/types";
import { loadLocalDataset, refreshDataset, type Deps } from "../services/datasetService";
import { useAuctions } from "./auctions";

interface DatasetStore {
  dataset: Dataset | null;
  status: "loading" | "ready" | "missing";
  boot(deps?: Deps): Promise<void>;
  refresh(deps?: Deps): Promise<boolean>;
}

function midAuctionInCorso(): boolean {
  return Object.values(useAuctions.getState().byLeague)
    .some(a => a.purchases.length > 0);
}

export const useDataset = create<DatasetStore>()((set, get) => ({
  dataset: null,
  status: "loading",
  async boot(deps) {
    let local: Dataset | null = null;
    try {
      local = await loadLocalDataset(deps);
    } catch {
      local = null; // belt-and-braces: loadLocalDataset già non dovrebbe rigettare
    }
    if (local) set({ dataset: local, status: "ready" });

    if (midAuctionInCorso()) {
      // asta in corso: non toccare il dataset locale con un refresh automatico
      if (!get().dataset) set({ status: "missing" });
      return;
    }

    try {
      const { dataset, updated } = await refreshDataset(local, deps);
      set({ dataset, status: "ready" });
      void updated;
    } catch {
      if (!get().dataset) set({ status: "missing" });
    }
  },
  async refresh(deps) {
    const { dataset } = get();
    try {
      const res = await refreshDataset(dataset, deps);
      set({ dataset: res.dataset, status: "ready" });
      return res.updated;
    } catch {
      if (!get().dataset) set({ status: "missing" });
      return false;
    }
  },
}));
