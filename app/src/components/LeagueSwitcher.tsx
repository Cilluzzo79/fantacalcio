import { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useLeagues } from "../store/leagues";
import { colors, radius, spacing } from "../ui/theme";
import { T } from "../ui/T";

export function LeagueSwitcher() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { leagues, activeLeagueId, setActiveLeague } = useLeagues();
  const active = leagues.find(l => l.id === activeLeagueId);
  return (
    <>
      <Pressable onPress={() => setOpen(true)}
        style={{ flexDirection: "row", alignItems: "center", gap: spacing(1) }}>
        <T variant="display" style={{ fontSize: 20, color: colors.accent }}>
          {active ? active.nome.toUpperCase() : "NESSUNA LEGA"}
        </T>
        <Ionicons name="chevron-down" size={16} color={colors.accent} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade"
        onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "#000A" }}
          onPress={() => setOpen(false)}>
          <View style={{ marginTop: 90, marginHorizontal: spacing(6),
            backgroundColor: colors.surface, borderRadius: radius.lg,
            borderWidth: 1, borderColor: colors.line, overflow: "hidden" }}>
            {leagues.map(l => (
              <Pressable key={l.id}
                onPress={() => { setActiveLeague(l.id); setOpen(false); }}
                style={{ padding: spacing(4), borderBottomWidth: 1,
                  borderBottomColor: colors.line,
                  backgroundColor: l.id === activeLeagueId
                    ? colors.surfaceAlt : "transparent" }}>
                <T variant="title">{l.nome}</T>
                <T variant="dim">{l.teams.length} squadre</T>
              </Pressable>
            ))}
            <Pressable onPress={() => { setOpen(false); router.navigate("/"); }}
              style={{ padding: spacing(4) }}>
              <T variant="title" style={{ color: colors.accent }}>
                Gestisci leghe…</T>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
