import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "./theme";
import { T } from "./T";
import { Button } from "./Button";

/** Stato vuoto/guardia riusabile per le tab: icona grande attenuata, titolo,
 * sottotitolo opzionale e CTA ghost opzionale. Sostituisce i blocchi
 * "dataset mancante" / "nessuna lega" / "niente da riepilogare" improvvisati
 * nelle singole schermate con un unico componente coerente. */
export function EmptyState({ icon, title, subtitle, cta, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  cta?: string;
  onPress?(): void;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing(3) }}>
      <Ionicons name={icon} size={48} color={colors.textDim} />
      <T variant="title" style={{ textAlign: "center" }}>{title}</T>
      {subtitle && (
        <T variant="dim" style={{ textAlign: "center" }}>{subtitle}</T>
      )}
      {cta && onPress && (
        <Button title={cta} variant="ghost" onPress={onPress} />
      )}
    </View>
  );
}
