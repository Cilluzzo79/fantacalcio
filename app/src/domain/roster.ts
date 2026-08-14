import type { League, Player, Ruolo } from "./types";

const RUOLI: Ruolo[] = ["P", "D", "C", "A"];

export interface RosterCheckInput {
  league: League;
  players: Map<number, Player>;
  teamId: string;
  roster: { playerId: number; prezzo: number }[];
  creditiResidui: number;
  takenElsewhere: Set<number>; // playerId già nei roster delle ALTRE squadre
}

export function validateRosterIniziale(input: RosterCheckInput): string[] {
  const { league, players, roster, creditiResidui, takenElsewhere } = input;
  const problemi: string[] = [];
  const visti = new Set<number>();
  const perRuolo: Record<Ruolo, number> = { P: 0, D: 0, C: 0, A: 0 };

  for (const r of roster) {
    const pl = players.get(r.playerId);
    if (!pl) { problemi.push(`giocatore sconosciuto (id ${r.playerId})`); continue; }
    if (visti.has(r.playerId)) problemi.push(`${pl.nome}: duplicato nel roster`);
    visti.add(r.playerId);
    if (takenElsewhere.has(r.playerId))
      problemi.push(`${pl.nome}: già in un'altra squadra`);
    if (r.prezzo < 1) problemi.push(`${pl.nome}: prezzo minimo 1`);
    perRuolo[pl.ruolo] += 1;
  }
  let slotVuoti = 0;
  for (const ruolo of RUOLI) {
    if (perRuolo[ruolo] > league.slots[ruolo])
      problemi.push(
        `troppi ${ruolo}: ${perRuolo[ruolo]}/${league.slots[ruolo]}`);
    slotVuoti += Math.max(0, league.slots[ruolo] - perRuolo[ruolo]);
  }
  if (creditiResidui < 0) problemi.push("crediti residui negativi");
  else if (creditiResidui < slotVuoti)
    problemi.push(
      `crediti residui insufficienti: ${creditiResidui} per ${slotVuoti} slot vuoti (serve ≥1 a slot)`);
  return problemi;
}
