import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: "Lega" }} />
      <Tabs.Screen name="listone" options={{ title: "Listone" }} />
    </Tabs>
  );
}
