import type { Dataset, Player, Ruolo } from "../types";

let nextId = 1;
export function mkPlayer(p: Partial<Player> & { ruolo: Ruolo }): Player {
  return {
    id: nextId++, sofaId: 1000 + nextId, nome: `Player${nextId}`, squadra: "Inter",
    qta: 10, fvm: 50, fascia: "titolare", valueScore: 20, fmProj: 6.5,
    votoProj: 6.1, startsShare: 0.8, affidabilita: 90, traits: [], note: [],
    seasons: [], ...p,
  };
}

export function miniDataset(): Dataset {
  nextId = 1;
  return {
    schemaVersion: 1, generatedAt: "2026-08-13T07:00:00+00:00",
    season: "2026-27", quotazioniFile: "quot.xlsx",
    players: [
      mkPlayer({ ruolo: "P", nome: "PortiereTop", valueScore: 30 }),
      mkPlayer({ ruolo: "P", nome: "PortiereLow", valueScore: 5, fascia: "lowcost" }),
      mkPlayer({ ruolo: "D", nome: "DifTop", valueScore: 40, fascia: "top" }),
      mkPlayer({ ruolo: "D", nome: "DifLow", valueScore: 5, fascia: "lowcost" }),
      mkPlayer({ ruolo: "C", nome: "CenTop", valueScore: 50, fascia: "top", traits: ["assistman"] }),
      mkPlayer({ ruolo: "C", nome: "CenLow", valueScore: 5, fascia: "lowcost" }),
      mkPlayer({ ruolo: "A", nome: "AttTop", valueScore: 80, fascia: "top", traits: ["rigorista"] }),
      mkPlayer({ ruolo: "A", nome: "AttLow", valueScore: 10, fascia: "scommessa" }),
    ],
  };
}
