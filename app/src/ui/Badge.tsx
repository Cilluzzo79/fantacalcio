import { View } from "react-native";
import type { Fascia } from "../domain/types";
import { colors, FASCIA_LABEL, radius, spacing } from "./theme";
import { T } from "./T";

export function Badge({ fascia, text, color }: {
  fascia?: Fascia; text?: string; color?: string;
}) {
  const c = fascia ? colors.fasce[fascia] : (color ?? colors.textDim);
  const label = fascia ? FASCIA_LABEL[fascia] : (text ?? "");
  return (
    <View style={{ borderColor: c, borderWidth: 1, borderRadius: radius.sm,
      paddingHorizontal: spacing(1.5), paddingVertical: 1, alignSelf: "flex-start" }}>
      <T variant="label" style={{ color: c }}>{label}</T>
    </View>
  );
}
