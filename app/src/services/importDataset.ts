import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { importDatasetFromText } from "./datasetService";
import { useDataset } from "../store/dataset";

export async function importFromDevice(): Promise<"ok" | "annullato"> {
  const res = await DocumentPicker.getDocumentAsync({
    type: "application/json", copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.[0]) return "annullato";
  const text = await FileSystem.readAsStringAsync(res.assets[0].uri);
  const ds = await importDatasetFromText(text); // valida e salva
  useDataset.setState({ dataset: ds, status: "ready", lastError: null,
    lastChecked: new Date().toISOString() });
  return "ok";
}
