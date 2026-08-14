import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { colors, fonts, radius, spacing } from "./theme";
import { T } from "./T";
import { parseIntero } from "./parse";

export function NumberField({ label, value, onChange, min, max, step = 1 }: {
  label: string; value: number; onChange(n: number): void;
  min: number; max: number; step?: number;
}) {
  const [raw, setRaw] = useState<string | null>(null); // null = non in editing
  const commit = (text: string) => {
    onChange(parseIntero(text, { min, max, fallback: value }));
    setRaw(null);
  };
  // ogni tasto premuto committa subito il valore parsato (clampato):
  // digitare un prezzo e toccare subito ASSEGNA/Salva senza far scattare
  // onEndEditing non deve più registrare il valore precedente. Il testo
  // mostrato (`raw`) resta quello digitato, non quello clampato: si corregge
  // da solo al tasto successivo (v. commento CAREFUL nel piano).
  const onChangeText = (text: string) => {
    setRaw(text);
    onChange(parseIntero(text, { min, max, fallback: value }));
  };
  const bump = (d: number) => {
    setRaw(null); // scarta un raw pendente: non deve mascherare il nuovo value
    onChange(Math.min(max, Math.max(min, value + d * step)));
  };
  return (
    <View style={{ marginBottom: spacing(3) }}>
      <T variant="label" style={{ marginBottom: spacing(1) }}>{label}</T>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing(2) }}>
        <Stepper sign="−" onPress={() => bump(-1)} />
        <TextInput
          value={raw ?? String(value)}
          onChangeText={onChangeText}
          onEndEditing={e => commit(e.nativeEvent.text)}
          keyboardType="number-pad"
          style={{ flex: 1, textAlign: "center", color: colors.text,
            fontFamily: fonts.display, fontSize: 24,
            fontVariant: ["tabular-nums"],
            backgroundColor: colors.surface, borderColor: colors.line,
            borderWidth: 1, borderRadius: radius.md,
            paddingVertical: spacing(2) }} />
        <Stepper sign="+" onPress={() => bump(1)} />
      </View>
    </View>
  );
}

function Stepper({ sign, onPress }: { sign: string; onPress(): void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({
      width: 44, height: 44, borderRadius: radius.md, borderWidth: 1,
      borderColor: colors.line, alignItems: "center", justifyContent: "center",
      backgroundColor: pressed ? colors.surfaceAlt : colors.surface })}>
      <T variant="number" style={{ color: colors.accent }}>{sign}</T>
    </Pressable>
  );
}
