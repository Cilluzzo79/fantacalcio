import { Text, type TextProps } from "react-native";
import { colors, fonts } from "./theme";

type Variant = "display" | "number" | "title" | "body" | "label" | "dim";

const styles: Record<Variant, object> = {
  display: { fontFamily: fonts.display, fontSize: 30, color: colors.text,
    letterSpacing: 0.5 },
  number: { fontFamily: fonts.display, fontSize: 24, color: colors.text,
    fontVariant: ["tabular-nums"] as const },
  title: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 14, color: colors.text },
  label: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.textDim,
    textTransform: "uppercase" as const, letterSpacing: 1.2 },
  dim: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim },
};

export function T({ variant = "body", style, ...rest }:
  TextProps & { variant?: Variant }) {
  return <Text {...rest} style={[styles[variant], style]} />;
}
