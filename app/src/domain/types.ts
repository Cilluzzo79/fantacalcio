export type Ruolo = "P" | "D" | "C" | "A";
export type Fascia = "top" | "semitop" | "titolare" | "scommessa" | "lowcost";

export interface SeasonRow {
  season: string; torneo: string; coeff: number; pg: number; min: number;
  gol: number; assist: number; amm: number; esp: number; rating: number | null;
  rigCalc: number; rigSegn: number;
  golSubiti: number | null; cleanSheet: number | null; rigParati: number | null;
}

export interface Player {
  id: number; sofaId: number | null; nome: string; ruolo: Ruolo; squadra: string;
  qta: number; fvm: number; fascia: Fascia; valueScore: number; fmProj: number;
  votoProj: number; startsShare: number; affidabilita: number;
  traits: string[]; note: string[]; seasons: SeasonRow[];
}

export interface Coach { nome: string; squadra: string; qta: number; }

export interface Dataset {
  schemaVersion: 1; generatedAt: string; season: string; quotazioniFile: string;
  players: Player[];
  allenatori?: Coach[];
}

export interface TeamConfig {
  id: string;            // uuid locale
  nome: string;
  crediti: number;       // in modalità riparazione: crediti RESIDUI
  rosterIniziale: { playerId: number; prezzo: number }[]; // vuoto per asta estiva
}

export interface League {
  id: string; nome: string;
  slots: Record<Ruolo, number>;    // default {P:3,D:8,C:8,A:6}
  teams: TeamConfig[];             // teams[myTeamIndex] è l'utente
  myTeamIndex: number;
  createdAt: string;               // ISO
  useCoaches?: boolean;
}

export interface Purchase {
  id: string;            // uuid evento
  playerId: number; teamId: string; prezzo: number; ts: string;
}

export interface CoachPurchase {
  id: string; teamId: string; nome: string; squadra: string;
  prezzo: number; ts: string;
}

export interface AuctionState {
  leagueId: string; purchases: Purchase[];
  coaches?: CoachPurchase[];
}
