import { useState } from "react";
import { Alert, Pressable, ScrollView, Switch, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLeagues, MAX_LEAGUES, DEFAULT_SLOTS } from "../../store/leagues";
import type { League, Ruolo } from "../../domain/types";
import { colors, fonts, radius, spacing } from "../../ui/theme";
import { T } from "../../ui/T";
import { Button } from "../../ui/Button";
import { NumberField } from "../../ui/NumberField";
import { Screen } from "../../ui/Screen";
import { DatasetBanner } from "../../components/DatasetBanner";
import { TeamRosterEditor } from "../../components/TeamRosterEditor";

const RUOLI: { key: Ruolo; label: string }[] = [
  { key: "P", label: "Portieri" }, { key: "D", label: "Difensori" },
  { key: "C", label: "Centrocampisti" }, { key: "A", label: "Attaccanti" },
];

function nomiDefault(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `Squadra ${i + 1}`);
}

export default function LegaScreen() {
  const leagues = useLeagues(s => s.leagues);
  const activeLeagueId = useLeagues(s => s.activeLeagueId);
  const updateLeague = useLeagues(s => s.updateLeague);
  const deleteLeague = useLeagues(s => s.deleteLeague);
  const setActiveLeague = useLeagues(s => s.setActiveLeague);

  const [creating, setCreating] = useState(false);
  const active = leagues.find(l => l.id === activeLeagueId) ?? null;

  function onDeleteLeague(l: League) {
    Alert.alert("Eliminare la lega?",
      `"${l.nome}" e tutte le rose verranno eliminate definitivamente.`,
      [
        { text: "Annulla", style: "cancel" },
        { text: "Elimina", style: "destructive", onPress: () => deleteLeague(l.id) },
      ]);
  }

  return (
    <Screen>
      <ScrollView style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: spacing(4), paddingBottom: spacing(10) }}
        keyboardShouldPersistTaps="handled">
        <DatasetBanner />

        <T variant="label" style={{ marginBottom: spacing(2) }}>Le tue leghe</T>
        {leagues.length === 0 && (
          <T variant="dim" style={{ marginBottom: spacing(3) }}>Nessuna lega creata.</T>
        )}
        {leagues.map(l => (
          <LeagueListItem key={l.id} league={l} active={l.id === activeLeagueId}
            onSelect={() => setActiveLeague(l.id)}
            onRename={nome => updateLeague(l.id, { nome })}
            onDelete={() => onDeleteLeague(l)} />
        ))}

        {creating
          ? <CreateLeagueForm existingCount={leagues.length}
              onCreated={() => setCreating(false)}
              onCancel={() => setCreating(false)} />
          : (
            <>
              <Button title="+ Nuova lega" variant="ghost"
                disabled={leagues.length >= MAX_LEAGUES}
                onPress={() => setCreating(true)}
                style={{ marginTop: spacing(2), marginBottom: spacing(2) }} />
              {leagues.length >= MAX_LEAGUES && (
                <T variant="dim" style={{ marginBottom: spacing(4) }}>
                  Massimo {MAX_LEAGUES} leghe raggiunto.</T>
              )}
            </>
          )}

        {active && !creating && <RosterRepairSection league={active} />}
      </ScrollView>
    </Screen>
  );
}

function LeagueListItem({ league, active, onSelect, onRename, onDelete }: {
  league: League; active: boolean;
  onSelect(): void; onRename(nome: string): void; onDelete(): void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(league.nome);

  function commitRename() {
    const nome = draft.trim();
    if (nome && nome !== league.nome) onRename(nome);
    else setDraft(league.nome);
    setEditing(false);
  }

  const totaleSlot = league.slots.P + league.slots.D + league.slots.C + league.slots.A;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing(2),
      borderWidth: 1, borderColor: active ? colors.accent : colors.line,
      backgroundColor: active ? colors.surfaceAlt : colors.surface,
      borderRadius: radius.md, padding: spacing(3), marginBottom: spacing(2) }}>
      {editing ? (
        <TextInput value={draft} onChangeText={setDraft} autoFocus
          onEndEditing={commitRename} onSubmitEditing={commitRename}
          style={{ flex: 1, color: colors.text, fontFamily: fonts.bodyBold, fontSize: 16,
            borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: spacing(1) }} />
      ) : (
        <Pressable style={{ flex: 1 }} onPress={onSelect}>
          <T variant="title" style={{ color: active ? colors.accent : colors.text }}>
            {league.nome}</T>
          <T variant="dim">{league.teams.length} squadre · {totaleSlot} slot</T>
        </Pressable>
      )}
      <Pressable onPress={() => (editing ? commitRename() : setEditing(true))} hitSlop={8}>
        <Ionicons name={editing ? "checkmark" : "pencil-outline"} size={18} color={colors.textDim} />
      </Pressable>
      <Pressable onPress={onDelete} hitSlop={8}>
        <Ionicons name="trash-outline" size={18} color={colors.danger} />
      </Pressable>
    </View>
  );
}

function CreateLeagueForm({ existingCount, onCreated, onCancel }: {
  existingCount: number; onCreated(): void; onCancel(): void;
}) {
  const createLeague = useLeagues(s => s.createLeague);
  const updateLeague = useLeagues(s => s.updateLeague);

  const [nome, setNome] = useState("");
  const [teamCount, setTeamCount] = useState(8);
  const [crediti, setCrediti] = useState(500);
  const [slots, setSlots] = useState<Record<Ruolo, number>>({ ...DEFAULT_SLOTS });
  const [teamNames, setTeamNames] = useState<string[]>(nomiDefault(8));
  const [myTeamIndex, setMyTeamIndex] = useState(0);
  const [useCoaches, setUseCoaches] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  function onTeamCountChange(n: number) {
    setTeamCount(n);
    setTeamNames(prev => n > prev.length
      ? [...prev, ...nomiDefault(n).slice(prev.length)]
      : prev.slice(0, n));
    if (myTeamIndex >= n) setMyTeamIndex(n - 1);
  }

  function onTeamNameChange(i: number, text: string) {
    setTeamNames(prev => prev.map((t, idx) => idx === i ? text : t));
  }

  function onCreate() {
    try {
      const league = createLeague({
        nome: nome.trim() || `Lega ${existingCount + 1}`,
        teamNames, crediti, slots, myTeamIndex,
      });
      if (useCoaches) updateLeague(league.id, { useCoaches: true });
      setErrore(null);
      onCreated();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <View style={{ borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface,
      borderRadius: radius.md, padding: spacing(3), marginBottom: spacing(4) }}>
      <T variant="label" style={{ marginBottom: spacing(1) }}>Nome lega</T>
      <TextInput placeholder={`Lega ${existingCount + 1}`} placeholderTextColor={colors.textDim}
        value={nome} onChangeText={setNome}
        style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
          padding: spacing(2.5), color: colors.text, marginBottom: spacing(3) }} />

      <NumberField label="Numero squadre" value={teamCount} onChange={onTeamCountChange} min={2} max={20} />
      <NumberField label="Crediti per squadra" value={crediti} onChange={setCrediti} min={1} max={5000} />

      <T variant="label" style={{ marginBottom: spacing(1) }}>Slot per ruolo</T>
      {RUOLI.map(r => (
        <NumberField key={r.key} label={r.label} value={slots[r.key]}
          onChange={n => setSlots(prev => ({ ...prev, [r.key]: n }))} min={0} max={15} />
      ))}

      <T variant="label" style={{ marginBottom: spacing(1) }}>Nomi squadre e la tua squadra</T>
      {teamNames.map((t, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: spacing(2),
          marginBottom: spacing(2) }}>
          <TextInput value={t} onChangeText={text => onTeamNameChange(i, text)}
            style={{ flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
              padding: spacing(2), color: colors.text }} />
          <Pressable onPress={() => setMyTeamIndex(i)}
            style={{ borderWidth: 1, borderRadius: radius.md,
              borderColor: myTeamIndex === i ? colors.accent : colors.line,
              backgroundColor: myTeamIndex === i ? colors.accent : "transparent",
              paddingHorizontal: spacing(2.5), paddingVertical: spacing(1.5) }}>
            <T variant="label" style={{ color: myTeamIndex === i ? colors.accentText : colors.textDim }}>
              {myTeamIndex === i ? "Mia" : "Scegli"}</T>
          </Pressable>
        </View>
      ))}

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        marginVertical: spacing(2) }}>
        <T variant="body">Usa allenatori</T>
        <Switch value={useCoaches} onValueChange={setUseCoaches}
          trackColor={{ false: colors.line, true: colors.accent }} thumbColor={colors.text} />
      </View>

      {errore && <T variant="dim" style={{ color: colors.danger, marginBottom: spacing(2) }}>{errore}</T>}

      <View style={{ flexDirection: "row", gap: spacing(2) }}>
        <Button title="Annulla" variant="ghost" onPress={onCancel} style={{ flex: 1 }} />
        <Button title="Crea lega" onPress={onCreate} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

function RosterRepairSection({ league }: { league: League }) {
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const myTeamId = league.teams[league.myTeamIndex]?.id;

  return (
    <View style={{ marginTop: spacing(2) }}>
      <T variant="label" style={{ marginBottom: spacing(2) }}>
        Riparazione rose — {league.nome}</T>
      {league.teams.map(team => {
        const expanded = expandedTeamId === team.id;
        return (
          <View key={team.id} style={{ borderWidth: 1, borderColor: colors.line,
            backgroundColor: colors.surface, borderRadius: radius.md,
            marginBottom: spacing(2), overflow: "hidden" }}>
            <Pressable onPress={() => setExpandedTeamId(expanded ? null : team.id)}
              style={{ flexDirection: "row", alignItems: "center", padding: spacing(3) }}>
              <View style={{ flex: 1 }}>
                <T variant="title" style={{ color: team.id === myTeamId ? colors.accent : colors.text }}>
                  {team.nome}{team.id === myTeamId ? " (tu)" : ""}
                </T>
                <T variant="dim">
                  {team.rosterIniziale.length} giocatori · {team.crediti} crediti residui</T>
              </View>
              <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.textDim} />
            </Pressable>
            {expanded && (
              <View style={{ padding: spacing(3), paddingTop: 0 }}>
                <TeamRosterEditor league={league} team={team}
                  onSave={() => setExpandedTeamId(null)} />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}
