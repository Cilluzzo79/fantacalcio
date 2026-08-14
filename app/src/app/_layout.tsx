import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts, BarlowCondensed_600SemiBold, BarlowCondensed_700Bold }
  from "@expo-google-fonts/barlow-condensed";
import { Archivo_400Regular, Archivo_500Medium, Archivo_700Bold }
  from "@expo-google-fonts/archivo";
import { useEffect } from "react";
import { colors } from "../ui/theme";
import { useDataset } from "../store/dataset";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    BarlowCondensed_600SemiBold, BarlowCondensed_700Bold,
    Archivo_400Regular, Archivo_500Medium, Archivo_700Bold,
  });
  const boot = useDataset(s => s.boot);
  useEffect(() => { void boot(); }, [boot]);
  useEffect(() => { if (loaded) void SplashScreen.hideAsync(); }, [loaded]);
  if (!loaded) return null;
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }} />
    </>
  );
}
