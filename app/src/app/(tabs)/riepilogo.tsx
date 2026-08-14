import { useMemo } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useDataset } from "../../store/dataset";
import { useLeagues } from "../../store/leagues";
import { useAuctions } from "../../store/auctions";
import { useStrategy, type LeagueStrategy } from "../../store/strategy";
import { computeLive } from "../../domain/live";
import { buildRiepilogo, type DealRow } from "../../domain/riepilogo";
import { coachOf } from "../../domain/coach";
import type { Ruolo } from "../../domain/types";
import { colors, radius, spacing } from "../../ui/theme";
import { T } from "../../ui/T";
import { Button } from "../../ui/Button";
import { Screen } from "../../ui/Screen";
import { RoleChip } from "../../ui/RoleChip";
import { Badge } from "../../ui/Badge";

const RUOLI: Ruolo[] = ["P", "D", "C", "A"];
const ROLE_LABELS: Record<Ruolo, string> = {
  P: "Portieri", D: "Difensori", C: "Centrocampisti", A: "Attaccanti",
};
const EMPTY_STRATEGY: LeagueStrategy = { alloc: null, targets: [] };

export default function Riepilogo() {
  const dataset = useDataset(s => s.dataset);
  const status = useDataset(s => s.status);
  const leagues = useLeagues(s => s.leagues);
  const activeLeagueId = useLeagues(s => s.activeLeagueId);
  const getAuction = useAuctions(s => s.getAuction);
  const router = useRouter();

  const league = leagues.find(l => l.id === activeLeagueId) ?? null;
  const auction = league ? getAuction(league.id) : null;
  const strategy = useStrategy(s => (league ? s.getStrategy(league.id) : EMPTY_STRATEGY));

  const playersById = useMemo(() =>
    new Map((dataset?.players ?? []).map(p => [p.id, p])), [dataset]);

  const live = useMemo(() => {
    if (!dataset || !league || !auction) return null;
    return computeLive(dataset.players, league, auction);
  }, [dataset, league, auction]);

  // dipende da [dataset, league, auction] via `live` (già memoizzato sopra):
  // un nuovo riferimento di `live` implica ricalcolo, coerente col resto dell'app.
  const riepilogo = useMemo(() => {
    if (!league || !auction || !live) return null;
    return buildRiepilogo(league, auction, playersById, live);
  }, [league, auction, playersById, live]);

  if (!dataset) {
    if (status === "missing") {
      return (
        <Screen>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing(3) }}>
            <T variant="title">Dataset non disponibile</T>
            <T variant="dim" style={{ textAlign: "center" }}>
              Importa o aggiorna il dataset dalla tab Lega per vedere il riepilogo.</T>
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

  if (!league || !auction || !riepilogo) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing(3) }}>
          <T variant="title">Nessuna lega attiva</T>
          <T variant="dim" style={{ textAlign: "center" }}>
            Crea o seleziona una lega dalla tab Lega per vedere il riepilogo.</T>
          <Button title="Vai a Lega" onPress={() => router.navigate("/")} />
        </View>
      </Screen>
    );
  }

  const myTeam = league.teams[league.myTeamIndex];
  const coach = coachOf(auction, myTeam.id);
  const righeTotali = RUOLI.reduce((a, r) => a + riepilogo.rosa[r].length, 0);

  if (righeTotali === 0) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing(3) }}>
          <T variant="title">Niente da riepilogare</T>
          <T variant="dim" style={{ textAlign: "center" }}>
            Registra qualche acquisto in Asta per vedere affari, strapagati e spesa per reparto.</T>
          <Button title="Vai ad Asta" onPress={() => router.navigate("/asta")} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: spacing(4), paddingBottom: spacing(10) }}
        showsVerticalScrollIndicator={false}>

        <View style={{ flexDirection: "row", gap: spacing(4), marginBottom: spacing(5) }}>
          <View style={{ flex: 1 }}>
            <T variant="label">Spesa totale</T>
            <T variant="display" style={{ fontSize: 36, color: colors.accent }}>
              {riepilogo.spesaTotale}</T>
          </View>
          <View style={{ flex: 1 }}>
            <T variant="label">Residui</T>
            <T variant="display" style={{ fontSize: 36 }}>{riepilogo.residui}</T>
          </View>
        </View>

        <View style={{ gap: spacing(4), marginBottom: spacing(5) }}>
          {RUOLI.map(r => (
            <RoleSection key={r} ruolo={r} rows={riepilogo.rosa[r]} slotsTot={league.slots[r]} />
          ))}
        </View>

        <View style={{ flexDirection: "row", gap: spacing(3), marginBottom: spacing(5) }}>
          <DealCard title="Affari" rows={riepilogo.affari} color={colors.ok}
            empty="Nessun affare, ancora." />
          <DealCard title="Strapagati" rows={riepilogo.strapagati} color={colors.danger}
            empty="Nessuno strapagamento." />
        </View>

        {strategy.alloc && (
          <StrategyCompare alloc={strategy.alloc} spesaPerRuolo={riepilogo.spesaPerRuolo} />
        )}

        {coach && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing(2),
            borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface,
            borderRadius: radius.md, padding: spacing(3) }}>
            <Badge text="ALL" color={colors.textDim} />
            <T variant="body" style={{ flex: 1 }} numberOfLines={1}>{coach.nome}</T>
            <T variant="number" style={{ color: colors.accent }}>{coach.prezzo}</T>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function fmtDelta(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

function RoleSection({ ruolo, rows, slotsTot }: {
  ruolo: Ruolo; rows: DealRow[]; slotsTot: number;
}) {
  const vuoti = Math.max(0, slotsTot - rows.length);
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing(2), marginBottom: spacing(1.5) }}>
        <RoleChip ruolo={ruolo} size={20} />
        <T variant="title">{ROLE_LABELS[ruolo]}</T>
      </View>
      <View style={{ gap: spacing(1) }}>
        {rows.map(row => <RiepilogoRow key={row.playerId} row={row} />)}
        {Array.from({ length: vuoti }).map((_, i) => (
          <View key={`vuoto-${i}`} style={{ flexDirection: "row" }}>
            <T variant="dim">—</T>
          </View>
        ))}
      </View>
    </View>
  );
}

function RiepilogoRow({ row }: { row: DealRow }) {
  const deltaColor = row.delta < 0 ? colors.ok : row.delta > 0 ? colors.danger : colors.textDim;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <T variant="body" style={{ flex: 1 }} numberOfLines={1}>{row.nome}</T>
      <T variant="dim" style={{ marginRight: spacing(2) }}>{row.prezzo} vs {row.equo}</T>
      <T variant="number" style={{ fontSize: 15, color: deltaColor }}>{fmtDelta(row.delta)}</T>
    </View>
  );
}

function DealCard({ title, rows, color, empty }: {
  title: string; rows: DealRow[]; color: string; empty: string;
}) {
  return (
    <View style={{ flex: 1, borderWidth: 1, borderColor: color, backgroundColor: colors.surface,
      borderRadius: radius.md, padding: spacing(3) }}>
      <T variant="label" style={{ color, marginBottom: spacing(1.5) }}>{title}</T>
      {rows.length === 0 ? (
        <T variant="dim">{empty}</T>
      ) : rows.map(row => (
        <View key={row.playerId} style={{ marginBottom: spacing(1.5) }}>
          <T variant="body" numberOfLines={1}>{row.nome}</T>
          <T variant="dim" style={{ color }}>{row.prezzo} vs {row.equo} ({fmtDelta(row.delta)})</T>
        </View>
      ))}
    </View>
  );
}

function StrategyCompare({ alloc, spesaPerRuolo }: {
  alloc: Record<Ruolo, number>; spesaPerRuolo: Record<Ruolo, number>;
}) {
  return (
    <View style={{ marginBottom: spacing(5) }}>
      <T variant="label" style={{ marginBottom: spacing(2) }}>Spesa vs piano</T>
      <View style={{ borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface,
        borderRadius: radius.md, padding: spacing(3), gap: spacing(1.5) }}>
        {RUOLI.map(r => {
          const sfora = spesaPerRuolo[r] > alloc[r];
          return (
            <T key={r} variant="body" style={{ color: sfora ? colors.warn : colors.textDim }}>
              {r}: {spesaPerRuolo[r]}/{alloc[r]}</T>
          );
        })}
      </View>
    </View>
  );
}
