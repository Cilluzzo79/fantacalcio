import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useDataset } from "../../store/dataset";
import { useLeagues } from "../../store/leagues";
import { useAuctions } from "../../store/auctions";
import { useStrategy, type LeagueStrategy } from "../../store/strategy";
import { suggestBudgetSplit, targetWarnings } from "../../domain/strategy";
import { computeLive } from "../../domain/live";
import type { Player, Ruolo } from "../../domain/types";
import { colors, radius, spacing } from "../../ui/theme";
import { T } from "../../ui/T";
import { Button } from "../../ui/Button";
import { Screen } from "../../ui/Screen";
import { RoleChip } from "../../ui/RoleChip";
import { Badge } from "../../ui/Badge";
import { NumberField } from "../../ui/NumberField";

const RUOLI: Ruolo[] = ["P", "D", "C", "A"];
const ROLE_LABELS: Record<Ruolo, string> = {
  P: "Portieri", D: "Difensori", C: "Centrocampisti", A: "Attaccanti",
};
const MAX_RISULTATI = 30;
const MAX_PREZZO = 5000;
const EMPTY_STRATEGY: LeagueStrategy = { alloc: null, targets: [] };

export default function Strategia() {
  const dataset = useDataset(s => s.dataset);
  const status = useDataset(s => s.status);
  const leagues = useLeagues(s => s.leagues);
  const activeLeagueId = useLeagues(s => s.activeLeagueId);
  const getAuction = useAuctions(s => s.getAuction);
  const router = useRouter();

  const league = leagues.find(l => l.id === activeLeagueId) ?? null;

  const strategy = useStrategy(s => (league ? s.getStrategy(league.id) : EMPTY_STRATEGY));
  const setAlloc = useStrategy(s => s.setAlloc);
  const addTarget = useStrategy(s => s.addTarget);
  const setTargetPrice = useStrategy(s => s.setTargetPrice);
  const removeTarget = useStrategy(s => s.removeTarget);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");

  const playersById = useMemo(() =>
    new Map((dataset?.players ?? []).map(p => [p.id, p])), [dataset]);

  const suggested = useMemo(() => {
    if (!dataset || !league) return null;
    return suggestBudgetSplit(dataset.players, league);
  }, [dataset, league]);

  const auction = league ? getAuction(league.id) : null;
  // computeLive è usato solo per proporre il prezzo equo di default alla
  // aggiunta di un target (istantanea al momento del click, non reattiva).
  const live = useMemo(() => {
    if (!dataset || !league || !auction) return null;
    return computeLive(dataset.players, league, auction);
  }, [dataset, league, auction]);

  const escludiDalPicker = useMemo(() =>
    new Set(strategy.targets.map(t => t.playerId)), [strategy.targets]);

  const risultatiPicker = useMemo(() => {
    if (!dataset) return [];
    const q = query.toLowerCase();
    return dataset.players
      .filter(p => !escludiDalPicker.has(p.id))
      .filter(p => q === "" || p.nome.toLowerCase().includes(q))
      .slice(0, MAX_RISULTATI);
  }, [dataset, query, escludiDalPicker]);

  if (!dataset) {
    if (status === "missing") {
      return (
        <Screen>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing(3) }}>
            <T variant="title">Dataset non disponibile</T>
            <T variant="dim" style={{ textAlign: "center" }}>
              Importa o aggiorna il dataset dalla tab Lega per impostare la strategia.</T>
            <Button title="Vai a Lega" onPress={() => router.navigate("/")} />
          </View>
        </Screen>
      );
    }
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Screen>
    );
  }

  if (!league) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing(3) }}>
          <T variant="title">Nessuna lega attiva</T>
          <T variant="dim" style={{ textAlign: "center" }}>
            Crea o seleziona una lega dalla tab Lega per impostare budget e target.</T>
          <Button title="Vai a Lega" onPress={() => router.navigate("/")} />
        </View>
      </Screen>
    );
  }

  // binding separato: TS non propaga la narrowing di `league` (fatta col guard
  // sopra) dentro le closure dichiarate più sotto, che vengono invocate solo
  // più tardi da un evento; qui invece il tipo `League` è quello statico.
  const activeLeague = league;

  const alloc = strategy.alloc ?? suggested!;
  const budget = activeLeague.teams[activeLeague.myTeamIndex].crediti;
  const allocatedSum = RUOLI.reduce((a, r) => a + alloc[r], 0);
  const residuo = budget - allocatedSum;
  const warnings = targetWarnings(alloc, strategy.targets, playersById);

  function onChangeAlloc(ruolo: Ruolo, n: number) {
    setAlloc(activeLeague.id, { ...alloc, [ruolo]: n });
  }

  function onUseSuggested(ruolo: Ruolo) {
    setAlloc(activeLeague.id, { ...alloc, [ruolo]: suggested![ruolo] });
  }

  function onPickPlayer(p: Player) {
    const prezzo = live ? live.adjustedPrice(p.id) : 1;
    addTarget(activeLeague.id, p.id, prezzo);
    setQuery("");
    setPickerOpen(false);
  }

  return (
    <Screen>
      <ScrollView style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: spacing(4), paddingBottom: spacing(10) }}
        keyboardShouldPersistTaps="handled">

        <View style={{ flexDirection: "row", gap: spacing(4), marginBottom: spacing(4) }}>
          <View style={{ flex: 1 }}>
            <T variant="label">Budget</T>
            <T variant="display">{budget}</T>
          </View>
          <View style={{ flex: 1 }}>
            <T variant="label">Residuo</T>
            <T variant="display" style={{ color: residuo !== 0 ? colors.warn : colors.text }}>
              {residuo}</T>
          </View>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing(3), marginBottom: spacing(5) }}>
          {RUOLI.map(r => (
            <RoleAllocCard key={r} ruolo={r} alloc={alloc[r]} suggerito={suggested![r]} budget={budget}
              onChange={n => onChangeAlloc(r, n)} onUseSuggested={() => onUseSuggested(r)} />
          ))}
        </View>

        <View>
          <T variant="label" style={{ marginBottom: spacing(1) }}>Target</T>
          {warnings.map((w, i) => (
            <T key={i} variant="dim" style={{ color: colors.warn, marginBottom: spacing(0.5) }}>{w}</T>
          ))}

          <Button title="+ Aggiungi target" variant="ghost"
            onPress={() => setPickerOpen(true)} style={{ marginVertical: spacing(2) }} />

          {strategy.targets.length === 0 && (
            <T variant="dim">Nessun target impostato.</T>
          )}
          {strategy.targets.map(t => (
            <TargetRow key={t.playerId} player={playersById.get(t.playerId)} target={t}
              onChangePrezzo={n => setTargetPrice(activeLeague.id, t.playerId, n)}
              onRemove={() => removeTarget(activeLeague.id, t.playerId)} />
          ))}
        </View>
      </ScrollView>

      <TargetPickerModal visible={pickerOpen} query={query} onChangeQuery={setQuery}
        risultati={risultatiPicker} onPick={onPickPlayer} onClose={() => setPickerOpen(false)} />
    </Screen>
  );
}

function RoleAllocCard({ ruolo, alloc, suggerito, budget, onChange, onUseSuggested }: {
  ruolo: Ruolo; alloc: number; suggerito: number; budget: number;
  onChange(n: number): void; onUseSuggested(): void;
}) {
  return (
    <View style={{ flexBasis: "47%", flexGrow: 1, borderWidth: 1, borderColor: colors.line,
      backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing(3) }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing(2), marginBottom: spacing(1) }}>
        <RoleChip ruolo={ruolo} />
        <T variant="title">{ROLE_LABELS[ruolo]}</T>
      </View>
      <NumberField label="Crediti allocati" value={alloc} onChange={onChange} min={0} max={budget} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <T variant="dim">suggerito: {suggerito}</T>
        <Button title="Usa suggerito" variant="ghost" onPress={onUseSuggested}
          style={{ paddingHorizontal: spacing(2), paddingVertical: spacing(1) }} />
      </View>
    </View>
  );
}

function TargetRow({ player, target, onChangePrezzo, onRemove }: {
  player: Player | undefined; target: { playerId: number; prezzo: number };
  onChangePrezzo(n: number): void; onRemove(): void;
}) {
  return (
    <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
      padding: spacing(2), gap: spacing(1), marginBottom: spacing(2) }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing(2) }}>
        {player ? <RoleChip ruolo={player.ruolo} /> : null}
        <View style={{ flex: 1 }}>
          <T variant="body" numberOfLines={1}>
            {player ? player.nome : `id ${target.playerId} (sconosciuto)`}</T>
          {player && <T variant="dim" numberOfLines={1}>{player.squadra}</T>}
        </View>
        {player && <Badge fascia={player.fascia} />}
        <Pressable onPress={onRemove} hitSlop={8}>
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
        </Pressable>
      </View>
      <NumberField label="Prezzo obiettivo" value={target.prezzo}
        onChange={onChangePrezzo} min={1} max={MAX_PREZZO} />
    </View>
  );
}

function TargetPickerModal({ visible, query, onChangeQuery, risultati, onPick, onClose }: {
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
                <T variant="body" style={{ flex: 1 }} numberOfLines={1}>{item.nome}</T>
                <Badge fascia={item.fascia} />
                <T variant="dim">{item.squadra}</T>
              </Pressable>
            )} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
