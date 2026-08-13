import { useLeagues, MAX_LEAGUES } from "../leagues";

const input = (nome: string) => ({
  nome, teamNames: ["Io", "Avv1", "Avv2", "Avv3"], crediti: 500,
});

beforeEach(() => {
  useLeagues.setState({ leagues: [], activeLeagueId: null });
});

test("crea una lega con default corretti", () => {
  const l = useLeagues.getState().createLeague(input("Lega A"));
  expect(l.slots).toEqual({ P: 3, D: 8, C: 8, A: 6 });
  expect(l.teams).toHaveLength(4);
  expect(l.teams[0].crediti).toBe(500);
  expect(l.myTeamIndex).toBe(0);
  expect(useLeagues.getState().activeLeagueId).toBe(l.id);
});

test("massimo 5 leghe", () => {
  for (let i = 0; i < MAX_LEAGUES; i++) {
    useLeagues.getState().createLeague(input(`Lega ${i}`));
  }
  expect(() => useLeagues.getState().createLeague(input("Sesta"))).toThrow(/massimo 5/i);
});

test("modalità riparazione: rosa iniziale e crediti residui", () => {
  const l = useLeagues.getState().createLeague(input("Riparazione"));
  const team = l.teams[1];
  useLeagues.getState().setTeamRoster(l.id, team.id, [{ playerId: 7, prezzo: 40 }], 120);
  const updated = useLeagues.getState().leagues.find(x => x.id === l.id)!;
  expect(updated.teams[1].rosterIniziale).toEqual([{ playerId: 7, prezzo: 40 }]);
  expect(updated.teams[1].crediti).toBe(120);
});

test("createLeague: myTeamIndex fuori range -> errore", () => {
  expect(() => useLeagues.getState().createLeague({ ...input("Bad"), myTeamIndex: 4 }))
    .toThrow(/myTeamIndex non valido/);
  expect(() => useLeagues.getState().createLeague({ ...input("Bad2"), myTeamIndex: -1 }))
    .toThrow(/myTeamIndex non valido/);
});

test("updateLeague: myTeamIndex fuori range -> errore", () => {
  const l = useLeagues.getState().createLeague(input("Lega A"));
  expect(() => useLeagues.getState().updateLeague(l.id, { myTeamIndex: 99 }))
    .toThrow(/myTeamIndex non valido/);
  // il valore non deve essere cambiato
  expect(useLeagues.getState().leagues[0].myTeamIndex).toBe(0);
});

test("update e delete", () => {
  const l = useLeagues.getState().createLeague(input("Lega A"));
  useLeagues.getState().updateLeague(l.id, { nome: "Rinominata" });
  expect(useLeagues.getState().leagues[0].nome).toBe("Rinominata");
  useLeagues.getState().deleteLeague(l.id);
  expect(useLeagues.getState().leagues).toHaveLength(0);
  expect(useLeagues.getState().activeLeagueId).toBeNull();
});
