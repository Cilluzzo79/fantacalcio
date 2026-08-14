import { Pressable, type ViewStyle } from "react-native";
import { colors, radius, spacing } from "./theme";
import { T } from "./T";

const variants = {
  primary: { bg: colors.accent, fg: colors.accentText, border: colors.accent },
  ghost: { bg: "transparent", fg: colors.text, border: colors.line },
  danger: { bg: "transparent", fg: colors.danger, border: colors.danger },
};

export function Button({ title, onPress, variant = "primary", size = "md",
  disabled, style }: {
  title: string; onPress(): void;
  variant?: keyof typeof variants; size?: "md" | "lg";
  disabled?: boolean; style?: ViewStyle;
}) {
  const v = variants[variant];
  return (
    <Pressable onPress={onPress} disabled={disabled}
      style={({ pressed }) => [{
        backgroundColor: v.bg, borderColor: v.border, borderWidth: 1,
        borderRadius: radius.md, alignItems: "center", justifyContent: "center",
        paddingVertical: spacing(size === "lg" ? 4 : 2.5),
        paddingHorizontal: spacing(4),
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      }, style]}>
      <T variant={size === "lg" ? "title" : "body"}
        style={{ color: v.fg, fontFamily: "Archivo_700Bold",
          textTransform: "uppercase", letterSpacing: 1 }}>{title}</T>
    </Pressable>
  );
}
