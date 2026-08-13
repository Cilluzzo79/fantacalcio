import { useState } from "react";
import { Button, FlatList, Text, TextInput, View } from "react-native";
import { useDataset } from "../../store/dataset";
import { useLeagues } from "../../store/leagues";
import { isStale } from "../../services/datasetService";

export default function Home() {
  const { dataset, status, refresh } = useDataset();
  const { leagues, activeLeagueId, createLeague, setActiveLeague } = useLeagues();
  const [nome, setNome] = useState("");
  const [squadre, setSquadre] = useState("8");
  const [crediti, setCrediti] = useState("500");
  const [msg, setMsg] = useState<string | null>(null);

  function onCreate() {
    try {
      const n = Math.max(2, parseInt(squadre, 10) || 8);
      const teamNames = ["La mia squadra",
        ...Array.from({ length: n - 1 }, (_, i) => `Squadra ${i + 2}`)];
      createLeague({ nome: nome || `Lega ${leagues.length + 1}`,
        teamNames, crediti: Math.max(n * 25, parseInt(crediti, 10) || 500) });
      setMsg(null);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 8 }}>
      <Text style={{ fontSize: 18, fontWeight: "bold" }}>Dataset</Text>
      {status === "loading" && <Text>Caricamento…</Text>}
      {status === "missing" && <Text>Nessun dataset: serve connessione o import.</Text>}
      {dataset && (
        <Text>
          Stagione {dataset.season} · {dataset.players.length} giocatori ·
          aggiornato {dataset.generatedAt.slice(0, 10)}
          {isStale(dataset, new Date().toISOString()) ? " · VECCHIO" : ""}
        </Text>
      )}
      <Button title="Aggiorna dataset" onPress={() => void refresh()} />

      <Text style={{ fontSize: 18, fontWeight: "bold", marginTop: 16 }}>Leghe</Text>
      <TextInput placeholder="Nome lega" value={nome} onChangeText={setNome}
        style={{ borderWidth: 1, padding: 8 }} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput placeholder="Squadre" value={squadre} onChangeText={setSquadre}
          keyboardType="number-pad" style={{ borderWidth: 1, padding: 8, flex: 1 }} />
        <TextInput placeholder="Crediti" value={crediti} onChangeText={setCrediti}
          keyboardType="number-pad" style={{ borderWidth: 1, padding: 8, flex: 1 }} />
      </View>
      <Button title="Crea lega" onPress={onCreate} />
      {msg && <Text style={{ color: "red" }}>{msg}</Text>}
      <FlatList
        data={leagues}
        keyExtractor={l => l.id}
        renderItem={({ item }) => (
          <Text onPress={() => setActiveLeague(item.id)}
            style={{ padding: 8, fontWeight: item.id === activeLeagueId ? "bold" : "normal" }}>
            {item.id === activeLeagueId ? "▶ " : ""}{item.nome} · {item.teams.length} squadre
          </Text>
        )}
      />
    </View>
  );
}
