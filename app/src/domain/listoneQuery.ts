import type { Fascia, Player, Ruolo } from "./types";

export function normalizeSearch(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export interface ListoneFilter {
  text: string; ruolo: Ruolo | null; squadra: string | null;
  fascia: Fascia | null; sort: "equo" | "qta" | "aff";
}

export function queryListone(players: Player[], f: ListoneFilter,
  prezzo: (id: number) => number): Player[] {
  const q = normalizeSearch(f.text);
  const out = players.filter(p =>
    (!q || normalizeSearch(p.nome).includes(q))
    && (!f.ruolo || p.ruolo === f.ruolo)
    && (!f.squadra || p.squadra === f.squadra)
    && (!f.fascia || p.fascia === f.fascia));
  const key: (p: Player) => number =
    f.sort === "qta" ? p => p.qta
    : f.sort === "aff" ? p => p.affidabilita
    : p => prezzo(p.id);
  return [...out].sort((a, b) => key(b) - key(a));
}
