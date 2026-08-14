import { useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { useDataset } from "../store/dataset";
import { useAuctions } from "../store/auctions";
import { isStale } from "../services/datasetService";
import { importFromDevice } from "../services/importDataset";
import { colors, radius, spacing } from "../ui/theme";
import { T } from "../ui/T";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";

function formattaData(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function astaConAcquistiInCorso(): boolean {
  return Object.values(useAuctions.getState().byLeague)
    .some(a => a.purchases.length > 0);
}

/** Riga compatta con lo stato del dataset locale: riusabile (Lega, Asta). */
export function DatasetBanner() {
  const dataset = useDataset(s => s.dataset);
  const status = useDataset(s => s.status);
  const lastError = useDataset(s => s.lastError);
  const refresh = useDataset(s => s.refresh);
  const [busy, setBusy] = useState(false);

  async function doRefresh() {
    setBusy(true);
    try { await refresh(); } finally { setBusy(false); }
  }

  function onRefreshPress() {
    if (astaConAcquistiInCorso()) {
      Alert.alert(
        "Asta in corso",
        "C'è un'asta con acquisti registrati. Aggiornare il dataset ora?",
        [
          { text: "Annulla", style: "cancel" },
          { text: "Aggiorna", style: "destructive", onPress: () => void doRefresh() },
        ],
      );
      return;
    }
    void doRefresh();
  }

  async function onImportPress() {
    setBusy(true);
    try { await importFromDevice(); } finally { setBusy(false); }
  }

  const stale = dataset ? isStale(dataset, new Date().toISOString()) : false;

  return (
    <View style={{ borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface,
      borderRadius: radius.md, padding: spacing(3), marginBottom: spacing(4), gap: spacing(2) }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing(2) }}>
        {status === "ready"
          ? <Badge text="DATASET OK" color={colors.ok} />
          : status === "missing"
            ? <Badge text="MANCANTE" color={colors.danger} />
            : <Badge text="CARICAMENTO" color={colors.textDim} />}
        <View style={{ flex: 1 }}>
          {dataset
            ? <T variant="dim">
                Stagione {dataset.season} · {dataset.players.length} giocatori
                {" "}· aggiornato {formattaData(dataset.generatedAt)}
              </T>
            : <T variant="dim">Nessun dataset disponibile: aggiorna o importa un file.</T>}
        </View>
        {busy && <ActivityIndicator color={colors.accent} />}
      </View>
      {stale && <T variant="dim" style={{ color: colors.warn }}>
        Dataset più vecchio di 30 giorni</T>}
      {lastError && <T variant="dim" style={{ color: colors.danger }}>{lastError}</T>}
      <View style={{ flexDirection: "row", gap: spacing(2) }}>
        <Button title="Aggiorna" variant="ghost" onPress={onRefreshPress} disabled={busy} />
        <Button title="Importa file" variant="ghost" onPress={() => void onImportPress()} disabled={busy} />
      </View>
    </View>
  );
}
