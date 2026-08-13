import { useMemo, useState } from "react";
import { FlatList, Text, TextInput, View } from "react-native";
import { useDataset } from "../../store/dataset";
import { useLeagues } from "../../store/leagues";
import { computeLeaguePrices } from "../../domain/prices";

export default function Listone() {
  const dataset = useDataset(s => s.dataset);
  const { leagues, activeLeagueId } = useLeagues();
  const league = leagues.find(l => l.id === activeLeagueId) ?? null;
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    if (!dataset || !league) return [];
    const creditiMedi = league.teams.reduce((a, t) => a + t.crediti, 0) / league.teams.length;
    const prices = computeLeaguePrices(dataset.players, {
      teams: league.teams.length, creditiPerTeam: creditiMedi, slots: league.slots,
    });
    return dataset.players
      .filter(p => p.nome.toLowerCase().includes(q.toLowerCase()))
      .map(p => ({ p, prezzo: prices.get(p.id) ?? 1 }))
      .sort((a, b) => b.prezzo - a.prezzo);
  }, [dataset, league, q]);

  if (!dataset) return <Text style={{ padding: 16 }}>Dataset non caricato.</Text>;
  if (!league) return <Text style={{ padding: 16 }}>Crea o seleziona una lega.</Text>;

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <TextInput placeholder="Cerca giocatore" value={q} onChangeText={setQ}
        style={{ borderWidth: 1, padding: 8, marginBottom: 8 }} />
      <FlatList
        data={rows}
        keyExtractor={r => String(r.p.id)}
        renderItem={({ item }) => (
          <View style={{ flexDirection: "row", paddingVertical: 6 }}>
            <Text style={{ width: 24, fontWeight: "bold" }}>{item.p.ruolo}</Text>
            <Text style={{ flex: 1 }}>{item.p.nome} · {item.p.squadra} · {item.p.fascia}</Text>
            <Text style={{ fontWeight: "bold" }}>{item.prezzo}</Text>
          </View>
        )}
      />
    </View>
  );
}
