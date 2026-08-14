import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDataset } from "../store/dataset";
import { useLeagues } from "../store/leagues";
import { validateRosterIniziale } from "../domain/roster";
import type { League, Player, TeamConfig } from "../domain/types";
import { colors, radius, spacing } from "../ui/theme";
import { T } from "../ui/T";
import { Button } from "../ui/Button";
import { RoleChip } from "../ui/RoleChip";
import { NumberField } from "../ui/NumberField";

const MAX_RISULTATI = 30;
const MAX_PREZZO = 5000;

type RosterRow = { playerId: number; prezzo: number };

/** Riparazione della rosa iniziale di una squadra: aggiunta/rimozione giocatori,
 * prezzo pagato, crediti residui; valida e salva solo se senza problemi. */
export function TeamRosterEditor({ league, team, onSave }: {
  league: League; team: TeamConfig; onSave?(): void;
}) {
  const dataset = useDataset(s => s.dataset);
  const setTeamRoster = useLeagues(s => s.setTeamRoster);

  const [roster, setRoster] = useState<RosterRow[]>(team.rosterIniziale);
  const [creditiResidui, setCreditiResidui] = useState(team.crediti);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [problemi, setProblemi] = useState<string[]>([]);

  const playersById = useMemo(() =>
    new Map((dataset?.players ?? []).map(p => [p.id, p])), [dataset]);

  const takenElsewhere = useMemo(() => new Set(
    league.teams
      .filter(t => t.id !== team.id)
      .flatMap(t => t.rosterIniziale.map(r => r.playerId)),
  ), [league.teams, team.id]);

  const escludiDalPicker = useMemo(() =>
    new Set([...takenElsewhere, ...roster.map(r => r.playerId)]),
    [takenElsewhere, roster]);

  const risultatiPicker = useMemo(() => {
    if (!dataset) return [];
    const q = query.toLowerCase();
    return dataset.players
      .filter(p => !escludiDalPicker.has(p.id))
      .filter(p => q === "" || p.nome.toLowerCase().includes(q))
      .slice(0, MAX_RISULTATI);
  }, [dataset, query, escludiDalPicker]);

  function addPlayer(p: Player) {
    setRoster(prev => [...prev, { playerId: p.id, prezzo: 1 }]);
    setQuery("");
    setPickerOpen(false);
  }

  function removePlayer(playerId: number) {
    setRoster(prev => prev.filter(r => r.playerId !== playerId));
  }

  function updatePrezzo(playerId: number, prezzo: number) {
    setRoster(prev => prev.map(r => r.playerId === playerId ? { ...r, prezzo } : r));
  }

  function onSalva() {
    const out = validateRosterIniziale({
      league, players: playersById, teamId: team.id, roster, creditiResidui, takenElsewhere,
    });
    setProblemi(out);
    if (out.length === 0) {
      setTeamRoster(league.id, team.id, roster, creditiResidui);
      onSave?.();
    }
  }

  if (!dataset) {
    return (
      <View style={{ padding: spacing(3) }}>
        <T variant="dim">Dataset non disponibile: importa o aggiorna per modificare la rosa.</T>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing(1) }}>
      {roster.map(r => {
        const p = playersById.get(r.playerId);
        return (
          <RosterRowItem key={r.playerId} player={p} row={r}
            onChangePrezzo={n => updatePrezzo(r.playerId, n)}
            onRemove={() => removePlayer(r.playerId)} />
        );
      })}

      <Button title="+ Aggiungi giocatore" variant="ghost"
        onPress={() => setPickerOpen(true)} style={{ marginVertical: spacing(2) }} />

      <NumberField label="Crediti residui" value={creditiResidui}
        onChange={setCreditiResidui} min={0} max={MAX_PREZZO} />

      {problemi.length > 0 && (
        <View style={{ marginBottom: spacing(2) }}>
          {problemi.map((p, i) => (
            <T key={i} variant="dim" style={{ color: colors.danger }}>{p}</T>
          ))}
        </View>
      )}

      <Button title="Salva rosa" onPress={onSalva} />

      <PlayerPickerModal visible={pickerOpen} query={query} onChangeQuery={setQuery}
        risultati={risultatiPicker} onPick={addPlayer} onClose={() => setPickerOpen(false)} />
    </View>
  );
}

function RosterRowItem({ player, row, onChangePrezzo, onRemove }: {
  player: Player | undefined; row: RosterRow;
  onChangePrezzo(n: number): void; onRemove(): void;
}) {
  return (
    <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
      padding: spacing(2), gap: spacing(1) }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing(2) }}>
        {player ? <RoleChip ruolo={player.ruolo} /> : null}
        <T variant="body" style={{ flex: 1 }}>
          {player ? `${player.nome} · ${player.squadra}` : `id ${row.playerId} (sconosciuto)`}
        </T>
        <Pressable onPress={onRemove} hitSlop={8}>
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
        </Pressable>
      </View>
      <NumberField label="Prezzo pagato" value={row.prezzo}
        onChange={onChangePrezzo} min={1} max={MAX_PREZZO} />
    </View>
  );
}

function PlayerPickerModal({ visible, query, onChangeQuery, risultati, onPick, onClose }: {
  visible: boolean; query: string; onChangeQuery(q: string): void;
  risultati: Player[]; onPick(p: Player): void; onClose(): void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "#000A" }} onPress={onClose}>
        <Pressable style={{ marginTop: 80, marginHorizontal: spacing(4), flex: 1,
          backgroundColor: colors.surface, borderRadius: radius.lg,
          borderWidth: 1, borderColor: colors.line, overflow: "hidden",
          padding: spacing(3) }}>
          <TextInput placeholder="Cerca giocatore" placeholderTextColor={colors.textDim}
            value={query} onChangeText={onChangeQuery} autoFocus
            style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
              padding: spacing(2.5), color: colors.text, marginBottom: spacing(2) }} />
          <FlatList data={risultati} keyExtractor={p => String(p.id)}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<T variant="dim" style={{ padding: spacing(2) }}>
              Nessun giocatore trovato.</T>}
            renderItem={({ item }) => (
              <Pressable onPress={() => onPick(item)}
                style={{ flexDirection: "row", alignItems: "center", gap: spacing(2),
                  paddingVertical: spacing(2), borderBottomWidth: 1,
                  borderBottomColor: colors.line }}>
                <RoleChip ruolo={item.ruolo} size={20} />
                <T variant="body" style={{ flex: 1 }}>{item.nome}</T>
                <T variant="dim">{item.squadra}</T>
              </Pressable>
            )} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
