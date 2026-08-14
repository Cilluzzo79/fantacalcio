import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { importDatasetFromText } from "./datasetService";
import { useDataset } from "../store/dataset";

export async function importFromDevice(): Promise<"ok" | "annullato" | "errore"> {
  const res = await DocumentPicker.getDocumentAsync({
    type: "application/json", copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.[0]) return "annullato";
  try {
    const text = await FileSystem.readAsStringAsync(res.assets[0].uri);
    const ds = await importDatasetFromText(text); // valida e salva
    useDataset.setState({ dataset: ds, status: "ready", lastError: null,
      lastChecked: new Date().toISOString() });
    return "ok";
  } catch (e) {
    useDataset.setState({ lastError: "file non valido: " + (e instanceof Error ? e.message : "errore sconosciuto"),
      lastChecked: new Date().toISOString() });
    return "errore";
  }
}
