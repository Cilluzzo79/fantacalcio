import { useMemo } from "react";
import { ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useDataset } from "../../store/dataset";
import { useLeagues } from "../../store/leagues";
import { useAuctions } from "../../store/auctions";
import { computeLive } from "../../domain/live";
import type { SeasonRow } from "../../domain/types";
import { colors, radius, spacing } from "../../ui/theme";
import { T } from "../../ui/T";
import { Badge } from "../../ui/Badge";
import { RoleChip } from "../../ui/RoleChip";
import { Screen } from "../../ui/Screen";

function affidabilitaColor(v: number): string {
  if (v >= 80) return colors.ok;
  if (v >= 50) return colors.warn;
  return colors.danger;
}

const GK_COLS: { key: keyof SeasonRow; label: string }[] = [
  { key: "golSubiti", label: "GS" }, { key: "cleanSheet", label: "CS" },
  { key: "rigParati", label: "RigP" },
];
const CORE_COLS: { key: keyof SeasonRow; label: string }[] = [
  { key: "pg", label: "PG" }, { key: "gol", label: "Gol" },
  { key: "assist", label: "Ast" }, { key: "rating", label: "Voto" },
];

export default function PlayerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const playerId = Number(id);

  const dataset = useDataset(s => s.dataset);
  const leagues = useLeagues(s => s.leagues);
  const activeLeagueId = useLeagues(s => s.activeLeagueId);

  const league = leagues.find(l => l.id === activeLeagueId) ?? null;
  // sottoscrizione reattiva (vedi commento in asta.tsx): selettore inline,
  // non un riferimento imperativo a getAuction.
  const auction = useAuctions(s => (league ? s.getAuction(league.id) : null));

  const player = useMemo(() =>
    dataset?.players.find(p => p.id === playerId) ?? null, [dataset, playerId]);

  const live = useMemo(() => {
    if (!dataset || !league || !auction) return null;
    return computeLive(dataset.players, league, auction);
  }, [dataset, league, auction]);

  if (!dataset) {
    return (
      <Screen>
        <T variant="dim" style={{ marginTop: spacing(6), textAlign: "center" }}>
          Dataset non disponibile.</T>
      </Screen>
    );
  }
  if (!player) {
    return (
      <Screen>
        <T variant="dim" style={{ marginTop: spacing(6), textAlign: "center" }}>
          Giocatore non trovato.</T>
      </Screen>
    );
  }

  const equo = live ? live.adjustedPrice(player.id) : null;
  const hasGkStats = player.seasons.some(s =>
    s.golSubiti !== null || s.cleanSheet !== null || s.rigParati !== null);
  const cols = hasGkStats ? [...CORE_COLS, ...GK_COLS] : CORE_COLS;

  return (
    <Screen>
      <ScrollView style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: spacing(3), paddingBottom: spacing(10) }}
        showsVerticalScrollIndicator={false}>

        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing(2.5) }}>
          <RoleChip ruolo={player.ruolo} size={32} />
          <View style={{ flex: 1 }}>
            <T variant="display">{player.nome}</T>
            <T variant="dim">{player.squadra}</T>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: spacing(2), marginTop: spacing(2.5) }}>
          <Badge fascia={player.fascia} />
          <Badge text={`AFFIDABILITÀ ${player.affidabilita}`}
            color={affidabilitaColor(player.affidabilita)} />
        </View>

        <View style={{ borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface,
          borderRadius: radius.lg, padding: spacing(4), marginTop: spacing(4) }}>
          <T variant="label">EQUO LIVE</T>
          <T variant="display" style={{ fontSize: 48, color: colors.accent, marginTop: spacing(0.5) }}>
            {equo !== null ? equo : "—"}
          </T>
          {equo === null && (
            <T variant="dim" style={{ color: colors.warn, marginTop: spacing(1) }}>
              Crea una lega per vedere il prezzo live.</T>
          )}
          <View style={{ flexDirection: "row", gap: spacing(5), marginTop: spacing(3) }}>
            <StatMini label="QTA" value={player.qta} />
            <StatMini label="FVM" value={player.fvm} />
          </View>
        </View>

        {player.note.length > 0 && (
          <View style={{ marginTop: spacing(4) }}>
            <T variant="label" style={{ marginBottom: spacing(2) }}>Perché</T>
            {player.note.map((n, i) => (
              <View key={i} style={{ flexDirection: "row", gap: spacing(1.5),
                marginBottom: spacing(1) }}>
                <T variant="body" style={{ color: colors.accent }}>•</T>
                <T variant="body" style={{ flex: 1 }}>{n}</T>
              </View>
            ))}
          </View>
        )}

        {player.traits.length > 0 && (
          <View style={{ marginTop: spacing(4) }}>
            <T variant="label" style={{ marginBottom: spacing(2) }}>Tratti</T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing(1.5) }}>
              {player.traits.map((t, i) => <Badge key={i} text={t.toUpperCase()} />)}
            </View>
          </View>
        )}

        {player.seasons.length > 0 && (
          <View style={{ marginTop: spacing(4) }}>
            <T variant="label" style={{ marginBottom: spacing(2) }}>Stagioni</T>
            <SeasonsTable seasons={player.seasons} cols={cols} />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function StatMini({ label, value }: { label: string; value: number }) {
  return (
    <View>
      <T variant="label">{label}</T>
      <T variant="number">{value}</T>
    </View>
  );
}

function fmtCell(row: SeasonRow, key: keyof SeasonRow): string {
  const v = row[key];
  if (v === null || v === undefined) return "-";
  if (key === "rating") return (v as number).toFixed(2);
  return String(v);
}

function SeasonsTable({ seasons, cols }: {
  seasons: SeasonRow[]; cols: { key: keyof SeasonRow; label: string }[];
}) {
  const seasonW = 84, torneoW = 76, statW = 44;
  return (
    <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
      overflow: "hidden" }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={{ flexDirection: "row", backgroundColor: colors.surfaceAlt,
            paddingVertical: spacing(1.5) }}>
            <T variant="label" style={{ width: seasonW, paddingLeft: spacing(2) }}>Stagione</T>
            <T variant="label" style={{ width: torneoW }}>Torneo</T>
            {cols.map(c => (
              <T key={c.key} variant="label" style={{ width: statW, textAlign: "right" }}>
                {c.label}</T>
            ))}
          </View>
          {seasons.map((row, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center",
              paddingVertical: spacing(1.5), borderTopWidth: 1, borderTopColor: colors.line }}>
              <View style={{ width: seasonW, paddingLeft: spacing(2) }}>
                <T variant="body" style={{ fontSize: 13 }}>{row.season}</T>
                {row.coeff !== 1 && <T variant="dim" style={{ fontSize: 10 }}>×{row.coeff}</T>}
              </View>
              <T variant="dim" style={{ width: torneoW, fontSize: 12 }} numberOfLines={1}>
                {row.torneo}</T>
              {cols.map(c => (
                <T key={c.key} variant="body" style={{ width: statW, fontSize: 13, textAlign: "right" }}>
                  {fmtCell(row, c.key)}</T>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
