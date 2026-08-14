import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { useDataset } from "../../store/dataset";
import { useLeagues } from "../../store/leagues";
import { useAuctions } from "../../store/auctions";
import { computeLive } from "../../domain/live";
import { queryListone, type ListoneFilter } from "../../domain/listoneQuery";
import type { Coach, Fascia, Ruolo } from "../../domain/types";
import { colors, FASCIA_LABEL, fonts, radius, spacing } from "../../ui/theme";
import { T } from "../../ui/T";
import { Screen } from "../../ui/Screen";
import { EmptyState } from "../../ui/EmptyState";
import { PlayerRow, PLAYER_ROW_HEIGHT } from "../../components/PlayerRow";

const RUOLI: Ruolo[] = ["P", "D", "C", "A"];
const FASCE: Fascia[] = ["top", "semitop", "titolare", "scommessa", "lowcost"];
const SORTS: { key: ListoneFilter["sort"]; label: string }[] = [
  { key: "equo", label: "EQUO" }, { key: "qta", label: "QTA" }, { key: "aff", label: "AFF" },
];

export default function Listone() {
  const dataset = useDataset(s => s.dataset);
  const status = useDataset(s => s.status);
  const leagues = useLeagues(s => s.leagues);
  const activeLeagueId = useLeagues(s => s.activeLeagueId);
  const router = useRouter();

  const league = leagues.find(l => l.id === activeLeagueId) ?? null;
  // sottoscrizione reattiva (vedi commento in asta.tsx): selettore inline,
  // non un riferimento imperativo a getAuction.
  const auction = useAuctions(s => (league ? s.getAuction(league.id) : null));

  const [text, setText] = useState("");
  const [ruolo, setRuolo] = useState<Ruolo | null>(null);
  const [fascia, setFascia] = useState<Fascia | null>(null);
  const [squadra, setSquadra] = useState<string | null>(null);
  const [sort, setSort] = useState<ListoneFilter["sort"]>(() => league ? "equo" : "qta");
  const [squadraModalOpen, setSquadraModalOpen] = useState(false);
  const [showCoaches, setShowCoaches] = useState(false);

  const live = useMemo(() => {
    if (!dataset || !league || !auction) return null;
    return computeLive(dataset.players, league, auction);
  }, [dataset, league, auction]);

  // senza lega non c'è un prezzo equo su cui ordinare: si ripiega su QTA.
  useEffect(() => {
    if (!live && sort === "equo") setSort("qta");
  }, [live, sort]);

  const prezzoFn = useMemo(() => (live ? live.adjustedPrice : () => 0), [live]);

  const soldIds = useMemo(() => {
    if (!league || !auction) return new Set<number>();
    return new Set<number>([
      ...auction.purchases.map(p => p.playerId),
      ...league.teams.flatMap(t => t.rosterIniziale.map(x => x.playerId)),
    ]);
  }, [league, auction]);

  const squadre = useMemo(() =>
    dataset ? [...new Set(dataset.players.map(p => p.squadra))].sort() : [],
    [dataset]);

  const rows = useMemo(() => {
    if (!dataset) return [];
    return queryListone(dataset.players, { text, ruolo, squadra, fascia, sort }, prezzoFn);
  }, [dataset, text, ruolo, squadra, fascia, sort, prezzoFn]);

  const coachesEnabled = Boolean(league?.useCoaches && dataset?.allenatori);

  if (!dataset) {
    if (status === "missing") {
      return (
        <Screen>
          <EmptyState icon="cloud-offline-outline" title="Dataset non disponibile"
            subtitle="Importa o aggiorna il dataset dalla tab Lega per consultare il listone."
            cta="Vai a Lega" onPress={() => router.navigate("/")} />
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

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: spacing(4), paddingTop: spacing(3), gap: spacing(2.5) }}>
        <TextInput
          placeholder="Cerca giocatore" placeholderTextColor={colors.textDim}
          value={text} onChangeText={setText}
          style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
            paddingHorizontal: spacing(3), paddingVertical: spacing(2.5),
            color: colors.text, fontFamily: fonts.body }} />

        <View style={{ flexDirection: "row", gap: spacing(2) }}>
          {RUOLI.map(r => (
            <RuoloChip key={r} ruolo={r} active={ruolo === r}
              onPress={() => setRuolo(prev => prev === r ? null : r)} />
          ))}
          {coachesEnabled && (
            <Pressable onPress={() => setShowCoaches(v => !v)}
              style={{ width: 40, height: 40, borderRadius: radius.md,
                alignItems: "center", justifyContent: "center", borderWidth: 1,
                borderColor: colors.textDim,
                backgroundColor: showCoaches ? colors.textDim : "transparent" }}>
              <T style={{ fontFamily: fonts.display, fontSize: 13,
                color: showCoaches ? colors.bg : colors.textDim }}>ALL</T>
            </Pressable>
          )}
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing(1.5) }}>
          {FASCE.map(f => (
            <FasciaChip key={f} fascia={f} active={fascia === f}
              onPress={() => setFascia(prev => prev === f ? null : f)} />
          ))}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable onPress={() => setSquadraModalOpen(true)}
            style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
              paddingHorizontal: spacing(2.5), paddingVertical: spacing(1.8), maxWidth: "48%" }}>
            <T variant="body" numberOfLines={1}>{squadra ?? "Tutte le squadre"}</T>
          </Pressable>
          <SortSegment value={sort} onChange={setSort} disabledEquo={!live} />
        </View>

        {!league && (
          <T variant="dim" style={{ color: colors.warn }}>
            Crea una lega per vedere i prezzi live.</T>
        )}
      </View>

      <FlatList
        data={rows}
        keyExtractor={p => String(p.id)}
        style={{ marginTop: spacing(3) }}
        contentContainerStyle={{ paddingHorizontal: spacing(4), paddingBottom: spacing(8) }}
        getItemLayout={(_, index) =>
          ({ length: PLAYER_ROW_HEIGHT, offset: PLAYER_ROW_HEIGHT * index, index })}
        initialNumToRender={20}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 30)}>
            <PlayerRow player={item} prezzo={live ? prezzoFn(item.id) : null}
              venduto={soldIds.has(item.id)}
              onPress={() => router.push(`/player/${item.id}`)} />
          </Animated.View>
        )}
        ListEmptyComponent={
          <T variant="dim" style={{ marginTop: spacing(6), textAlign: "center" }}>
            Nessun giocatore trovato.</T>
        }
        ListFooterComponent={
          showCoaches && coachesEnabled && dataset.allenatori
            ? <CoachesSection coaches={dataset.allenatori} /> : null
        } />

      <SquadraModal visible={squadraModalOpen} squadre={squadre} selected={squadra}
        onSelect={s => { setSquadra(s); setSquadraModalOpen(false); }}
        onClose={() => setSquadraModalOpen(false)} />
    </Screen>
  );
}

function RuoloChip({ ruolo, active, onPress }: {
  ruolo: Ruolo; active: boolean; onPress(): void;
}) {
  const c = colors.roles[ruolo];
  return (
    <Pressable onPress={onPress}
      style={{ width: 40, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: c,
        alignItems: "center", justifyContent: "center",
        backgroundColor: active ? c : "transparent" }}>
      <T style={{ fontFamily: fonts.display, fontSize: 18, color: active ? colors.bg : c }}>
        {ruolo}</T>
    </Pressable>
  );
}

function FasciaChip({ fascia, active, onPress }: {
  fascia: Fascia; active: boolean; onPress(): void;
}) {
  const c = colors.fasce[fascia];
  return (
    <Pressable onPress={onPress}
      style={{ borderWidth: 1, borderColor: c, borderRadius: radius.sm,
        paddingHorizontal: spacing(2), paddingVertical: spacing(1),
        backgroundColor: active ? c : "transparent" }}>
      <T variant="label" style={{ color: active ? colors.bg : c }}>{FASCIA_LABEL[fascia]}</T>
    </Pressable>
  );
}

function SortSegment({ value, onChange, disabledEquo }: {
  value: ListoneFilter["sort"]; onChange(s: ListoneFilter["sort"]): void; disabledEquo: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", borderWidth: 1, borderColor: colors.line,
      borderRadius: radius.md, overflow: "hidden" }}>
      {SORTS.map((s, i) => {
        const disabled = s.key === "equo" && disabledEquo;
        const active = value === s.key;
        return (
          <Pressable key={s.key} disabled={disabled} onPress={() => onChange(s.key)}
            style={{ paddingHorizontal: spacing(2.5), paddingVertical: spacing(1.8),
              borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: colors.line,
              backgroundColor: active ? colors.accent : "transparent", opacity: disabled ? 0.3 : 1 }}>
            <T variant="label" style={{ color: active ? colors.accentText : colors.textDim }}>
              {s.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

function CoachesSection({ coaches }: { coaches: Coach[] }) {
  return (
    <View style={{ marginTop: spacing(4) }}>
      <T variant="label" style={{ marginBottom: spacing(2) }}>Allenatori</T>
      {coaches.map((c, i) => (
        <View key={`${c.nome}-${i}`}
          style={{ flexDirection: "row", alignItems: "center", paddingVertical: spacing(2),
            borderBottomWidth: 1, borderBottomColor: colors.line }}>
          <T variant="body" style={{ flex: 1 }} numberOfLines={1}>{c.nome}</T>
          <T variant="dim" style={{ marginRight: spacing(3) }}>{c.squadra}</T>
          <T variant="number" style={{ color: colors.accent }}>{c.qta}</T>
        </View>
      ))}
    </View>
  );
}

function SquadraModal({ visible, squadre, selected, onSelect, onClose }: {
  visible: boolean; squadre: string[]; selected: string | null;
  onSelect(s: string | null): void; onClose(): void;
}) {
  const data = ["__tutte__", ...squadre];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "#000A" }} onPress={onClose}>
        <Pressable style={{ marginTop: 100, marginHorizontal: spacing(6), maxHeight: "70%",
          backgroundColor: colors.surface, borderRadius: radius.lg,
          borderWidth: 1, borderColor: colors.line, overflow: "hidden" }}>
          <FlatList data={data} keyExtractor={s => s}
            renderItem={({ item }) => {
              const isTutte = item === "__tutte__";
              const active = isTutte ? selected === null : selected === item;
              return (
                <Pressable onPress={() => onSelect(isTutte ? null : item)}
                  style={{ padding: spacing(3.5), borderBottomWidth: 1,
                    borderBottomColor: colors.line,
                    backgroundColor: active ? colors.surfaceAlt : "transparent" }}>
                  <T variant="body" style={{ color: active ? colors.accent : colors.text }}>
                    {isTutte ? "Tutte le squadre" : item}</T>
                </Pressable>
              );
            }} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
