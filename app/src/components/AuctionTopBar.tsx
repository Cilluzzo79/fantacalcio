import { View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { teamSummary } from "../domain/auction";
import type { Ruolo } from "../domain/types";
import { colors, fonts, spacing } from "../ui/theme";
import { T } from "../ui/T";
import { RoleChip } from "../ui/RoleChip";

const RUOLI: Ruolo[] = ["P", "D", "C", "A"];

export type TeamSummary = ReturnType<typeof teamSummary>;

/** Barra sticky sempre visibile in asta: crediti residui MIEI (grande, in
 * giallo) a sinistra e slot liberi per ruolo a destra. Va ricalcolata dal
 * chiamante (useMemo su [dataset, league, auction]) ad ogni acquisto. */
export function AuctionTopBar({ summary }: { summary: TeamSummary }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line,
      paddingHorizontal: spacing(4), paddingVertical: spacing(3) }}>
      <View>
        <T variant="label">Residui miei</T>
        <Animated.View key={summary.residui} entering={FadeInUp.duration(200)}>
          <T style={{ fontFamily: fonts.display, fontSize: 40, color: colors.accent,
            fontVariant: ["tabular-nums"] }}>
            {summary.residui}
          </T>
        </Animated.View>
      </View>
      <View style={{ flexDirection: "row", gap: spacing(3) }}>
        {RUOLI.map(r => (
          <View key={r} style={{ alignItems: "center", gap: spacing(0.5) }}>
            <RoleChip ruolo={r} size={22} />
            <T variant="number">{summary.slotLiberi[r]}</T>
          </View>
        ))}
      </View>
    </View>
  );
}
