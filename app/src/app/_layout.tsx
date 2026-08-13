import { useEffect } from "react";
import { Stack } from "expo-router";
import { useDataset } from "../store/dataset";

export default function RootLayout() {
  const boot = useDataset(s => s.boot);
  useEffect(() => { void boot(); }, [boot]);
  return <Stack screenOptions={{ headerShown: false }} />;
}
