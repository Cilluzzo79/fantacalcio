import { View } from "react-native";
import type { Ruolo } from "../domain/types";
import { colors, fonts, radius } from "./theme";
import { T } from "./T";

export function RoleChip({ ruolo, size = 22 }: { ruolo: Ruolo; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: radius.sm,
      backgroundColor: colors.roles[ruolo],
      alignItems: "center", justifyContent: "center" }}>
      <T style={{ fontFamily: fonts.display, fontSize: size * 0.62,
        color: colors.bg }}>{ruolo}</T>
    </View>
  );
}
