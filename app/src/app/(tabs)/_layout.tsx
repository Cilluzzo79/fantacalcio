import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LeagueSwitcher } from "../../components/LeagueSwitcher";
import { colors, fonts } from "../../ui/theme";
import type { ColorValue } from "react-native";

const icon = (name: keyof typeof Ionicons.glyphMap) =>
  ({ color, size }: { color: ColorValue; size: number }) =>
    <Ionicons name={name} size={size} color={typeof color === "string" ? color : "#FFF"} />;

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: colors.bg },
      headerShadowVisible: false,
      headerTitle: () => <LeagueSwitcher />,
      headerTitleAlign: "left",
      tabBarStyle: { backgroundColor: colors.surface,
        borderTopColor: colors.line },
      tabBarActiveTintColor: colors.accent,
      tabBarInactiveTintColor: colors.textDim,
      tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 10,
        textTransform: "uppercase", letterSpacing: 0.5 },
      sceneStyle: { backgroundColor: colors.bg },
    }}>
      <Tabs.Screen name="index"
        options={{ title: "Lega", tabBarIcon: icon("shield-half") }} />
      <Tabs.Screen name="listone"
        options={{ title: "Listone", tabBarIcon: icon("list") }} />
      <Tabs.Screen name="strategia"
        options={{ title: "Strategia", tabBarIcon: icon("pie-chart") }} />
      <Tabs.Screen name="asta"
        options={{ title: "Asta", tabBarIcon: icon("flash") }} />
      <Tabs.Screen name="riepilogo"
        options={{ title: "Riepilogo", tabBarIcon: icon("podium") }} />
    </Tabs>
  );
}
