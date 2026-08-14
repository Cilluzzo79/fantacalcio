import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useDataset } from "../../store/dataset";
import { useLeagues } from "../../store/leagues";
import { useAuctions } from "../../store/auctions";
import { computeLive } from "../../domain/live";
import { teamSummary } from "../../domain/auction";
import { coachOf, maxCoachOfferta } from "../../domain/coach";
import { normalizeSearch, queryListone } from "../../domain/listoneQuery";
import type { Coach, Player } from "../../domain/types";
import { colors, fonts, radius, spacing } from "../../ui/theme";
import { T } from "../../ui/T";
import { Screen } from "../../ui/Screen";
import { EmptyState } from "../../ui/EmptyState";
import { PlayerRow, PLAYER_ROW_HEIGHT } from "../../components/PlayerRow";
import { AuctionTopBar } from "../../components/AuctionTopBar";
import { BidSheet, type BidSheetSubject } from "../../components/BidSheet";
import { PurchaseLog } from "../../components/PurchaseLog";
import { TeamsBoard } from "../../components/TeamsBoard";

type Mode = "players" | "coaches";
type Panel = "asta" | "registro" | "rose";

const PANEL_OPTIONS: { key: Panel; label: string }[] =
  [{ key: "asta", label: "ASTA" }, { key: "registro", label: "REGISTRO" }, { key: "rose", label: "ROSE" }];
const MODE_OPTIONS: { key: Mode; label: string }[] =
  [{ key: "players", label: "GIOCATORI" }, { key: "coaches", label: "ALLENATORI" }];

export default function Asta() {
  const dataset = useDataset(s => s.dataset);
  const status = useDataset(s => s.status);
  const leagues = useLeagues(s => s.leagues);
  const activeLeagueId = useLeagues(s => s.activeLeagueId);
  const getAuction = useAuctions(s => s.getAuction);
  const purchase = useAuctions(s => s.purchase);
  const purchaseCoach = useAuctions(s => s.purchaseCoach);
  const router = useRouter();

  const league = leagues.find(l => l.id === activeLeagueId) ?? null;
  const auction = league ? getAuction(league.id) : null;

  const [panel, setPanel] = useState<Panel>("asta");
  const [mode, setMode] = useState<Mode>("players");
  const [text, setText] = useState("");
  const [showSold, setShowSold] = useState(false);
  const [subject, setSubject] = useState<BidSheetSubject | null>(null);

  const playersById = useMemo(() =>
    new Map((dataset?.players ?? []).map(p => [p.id, p])), [dataset]);

  const live = useMemo(() => {
    if (!dataset || !league || !auction) return null;
    return computeLive(dataset.players, league, auction);
  }, [dataset, league, auction]);

  const myTeam = league ? league.teams[league.myTeamIndex] : null;

  // ricalcolato ad ogni acquisto: teamSummary dipende da `auction`, che è un
  // nuovo riferimento immutabile dopo ogni purchase/purchaseCoach.
  const summary = useMemo(() => {
    if (!league || !auction || !myTeam) return null;
    return teamSummary(auction, league, playersById, myTeam.id);
  }, [league, auction, myTeam, playersById]);

  const soldIds = useMemo(() => {
    if (!league || !auction) return new Set<number>();
    return new Set<number>([
      ...auction.purchases.map(p => p.playerId),
      ...league.teams.flatMap(t => t.rosterIniziale.map(x => x.playerId)),
    ]);
  }, [league, auction]);

  const prezzoFn = useMemo(() => (live ? live.adjustedPrice : () => 0), [live]);

  const playerRows = useMemo(() => {
    if (!dataset) return [];
    // CONTROLLER RULING: queryListone resta invariata; per la ricerca sui
    // soli non venduti si pre-filtra l'array prima di chiamarla.
    const pool = showSold ? dataset.players
      : dataset.players.filter(p => !soldIds.has(p.id));
    return queryListone(pool, { text, ruolo: null, squadra: null, fascia: null, sort: "equo" }, prezzoFn);
  }, [dataset, showSold, soldIds, text, prezzoFn]);

  const coachesEnabled = Boolean(league?.useCoaches && dataset?.allenatori);

  const purchasedCoachKeys = useMemo(() =>
    new Set((auction?.coaches ?? []).map(c => `${c.nome}|${c.squadra}`)), [auction]);

  // squadre che hanno già un allenatore: nel BidSheet in modalità allenatore
  // le relative chip vanno disabilitate, sullo stesso principio difensivo
  // usato per i giocatori/allenatori già venduti (pre-filtrati ovunque).
  const coachDisabledTeamIds = useMemo(() => {
    if (!league || !auction) return new Set<string>();
    return new Set(league.teams.filter(t => coachOf(auction, t.id) !== undefined).map(t => t.id));
  }, [league, auction]);

  const coachRows = useMemo(() => {
    if (!dataset?.allenatori) return [];
    const q = normalizeSearch(text);
    return dataset.allenatori
      .filter(c => !purchasedCoachKeys.has(`${c.nome}|${c.squadra}`))
      .filter(c => !q || normalizeSearch(c.nome).includes(q))
      .sort((a, b) => b.qta - a.qta);
  }, [dataset, text, purchasedCoachKeys]);

  if (!dataset) {
    if (status === "missing") {
      return (
        <Screen>
          <EmptyState icon="cloud-offline-outline" title="Dataset non disponibile"
            subtitle="Importa o aggiorna il dataset dalla tab Lega per gestire l'asta."
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

  if (!league || !auction || !myTeam || !summary) {
    return (
      <Screen>
        <EmptyState icon="shield-outline" title="Nessuna lega attiva"
          subtitle="Crea o seleziona una lega dalla tab Lega per gestire l'asta."
          cta="Vai a Lega" onPress={() => router.navigate("/")} />
      </Screen>
    );
  }

  // binding separato: TS non propaga la narrowing di `league`/`auction`/`myTeam`
  // (fatta col guard sopra) dentro le closure dichiarate più sotto, che vengono
  // invocate solo più tardi da un evento (stesso pattern di strategia.tsx).
  const activeLeague = league;
  const activeAuction = auction;
  const activeMyTeam = myTeam;
  const activeSummary = summary;

  function buyerNome(playerId: number): string {
    const purchased = activeAuction.purchases.find(p => p.playerId === playerId);
    if (purchased) {
      return activeLeague.teams.find(t => t.id === purchased.teamId)?.nome ?? "una squadra";
    }
    const team = activeLeague.teams.find(t => t.rosterIniziale.some(x => x.playerId === playerId));
    return team?.nome ?? "una squadra";
  }

  function onPressPlayer(p: Player) {
    if (soldIds.has(p.id)) {
      Alert.alert("Già acquistato", `Già acquistato da ${buyerNome(p.id)}.`);
      return;
    }
    if (!live) return;
    setSubject({ kind: "player", player: p, advice: live.bidAdvice(p.id) });
  }

  function onPressCoach(c: Coach) {
    setSubject({ kind: "coach", coach: c,
      maxOfferta: maxCoachOfferta(activeAuction, activeLeague, playersById, activeMyTeam.id) });
  }

  function handleRegister(teamId: string, prezzo: number, opts?: { force?: boolean }) {
    if (!subject) return;
    if (subject.kind === "player") {
      purchase(activeLeague.id, activeLeague, playersById,
        { playerId: subject.player.id, teamId, prezzo }, opts);
    } else {
      purchaseCoach(activeLeague.id, activeLeague, playersById,
        { teamId, nome: subject.coach.nome, squadra: subject.coach.squadra, prezzo }, opts);
    }
  }

  function handleRegistered() {
    setSubject(null);
    setText("");
  }

  return (
    <Screen padded={false}>
      <AuctionTopBar summary={activeSummary} />

      <View style={{ paddingHorizontal: spacing(4), paddingTop: spacing(3) }}>
        <Segment value={panel} onChange={p => setPanel(p)} options={PANEL_OPTIONS} />
      </View>

      {panel === "asta" && (
        <>
          <View style={{ paddingHorizontal: spacing(4), paddingTop: spacing(3), gap: spacing(2.5) }}>
            {coachesEnabled && <Segment value={mode} onChange={m => setMode(m)} options={MODE_OPTIONS} />}

            <TextInput
              placeholder={mode === "players" ? "Cerca giocatore" : "Cerca allenatore"}
              placeholderTextColor={colors.textDim}
              value={text} onChangeText={setText}
              style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
                paddingHorizontal: spacing(3), paddingVertical: spacing(2.5),
                color: colors.text, fontFamily: fonts.body }} />

            {mode === "players" && (
              <Pressable onPress={() => setShowSold(v => !v)}
                style={{ flexDirection: "row", alignItems: "center", gap: spacing(1.5) }}>
                <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1,
                  borderColor: colors.line,
                  backgroundColor: showSold ? colors.accent : "transparent" }} />
                <T variant="dim">Mostra venduti</T>
              </Pressable>
            )}
          </View>

          {mode === "players" ? (
            <FlatList
              data={playerRows}
              keyExtractor={p => String(p.id)}
              style={{ marginTop: spacing(3) }}
              contentContainerStyle={{ paddingHorizontal: spacing(4), paddingBottom: spacing(8) }}
              getItemLayout={(_, index) =>
                ({ length: PLAYER_ROW_HEIGHT, offset: PLAYER_ROW_HEIGHT * index, index })}
              initialNumToRender={20}
              renderItem={({ item }) => (
                <PlayerRow player={item} prezzo={prezzoFn(item.id)}
                  venduto={soldIds.has(item.id)}
                  onPress={() => onPressPlayer(item)} />
              )}
              ListEmptyComponent={
                <T variant="dim" style={{ marginTop: spacing(6), textAlign: "center" }}>
                  Nessun giocatore trovato.</T>
              } />
          ) : (
            <FlatList
              data={coachRows}
              keyExtractor={c => `${c.nome}|${c.squadra}`}
              style={{ marginTop: spacing(3) }}
              contentContainerStyle={{ paddingHorizontal: spacing(4), paddingBottom: spacing(8) }}
              renderItem={({ item }) => (
                <CoachRow coach={item} onPress={() => onPressCoach(item)} />
              )}
              ListEmptyComponent={
                <T variant="dim" style={{ marginTop: spacing(6), textAlign: "center" }}>
                  Nessun allenatore trovato.</T>
              } />
          )}
        </>
      )}

      {panel === "registro" && (
        <PurchaseLog league={activeLeague} auction={activeAuction} playersById={playersById} />
      )}

      {panel === "rose" && (
        <TeamsBoard league={activeLeague} auction={activeAuction} playersById={playersById} />
      )}

      <BidSheet visible={subject !== null} subject={subject}
        teams={activeLeague.teams} myTeamId={activeMyTeam.id}
        disabledTeamIds={coachDisabledTeamIds}
        onRegister={handleRegister} onRegistered={handleRegistered}
        onClose={() => setSubject(null)} />
    </Screen>
  );
}

function Segment<Key extends string>({ value, onChange, options }: {
  value: Key; onChange(v: Key): void; options: { key: Key; label: string }[];
}) {
  return (
    <View style={{ flexDirection: "row", borderWidth: 1, borderColor: colors.line,
      borderRadius: radius.md, overflow: "hidden" }}>
      {options.map((o, i) => {
        const active = value === o.key;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)}
            style={{ flex: 1, alignItems: "center", paddingVertical: spacing(2),
              borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: colors.line,
              backgroundColor: active ? colors.accent : "transparent" }}>
            <T variant="label" style={{ color: active ? colors.accentText : colors.textDim }}>
              {o.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

function CoachRow({ coach, onPress }: { coach: Coach; onPress(): void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({
      flexDirection: "row", alignItems: "center", paddingVertical: spacing(2.5),
      borderBottomWidth: 1, borderBottomColor: colors.line, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ flex: 1 }}>
        <T variant="body" numberOfLines={1}>{coach.nome}</T>
        <T variant="dim" numberOfLines={1}>{coach.squadra}</T>
      </View>
      <T variant="number" style={{ color: colors.accent }}>{coach.qta}</T>
    </Pressable>
  );
}
