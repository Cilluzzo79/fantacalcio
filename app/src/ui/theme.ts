export const colors = {
  bg: "#0B1220", surface: "#121B2E", surfaceAlt: "#1A2540", line: "#22304F",
  text: "#EAF0FA", textDim: "#8FA0BF",
  accent: "#FFD400", accentText: "#0B1220",
  ok: "#2ECC71", warn: "#FF9F1C", danger: "#FF4D5E",
  roles: { P: "#FFB020", D: "#3FA7FF", C: "#2ECC71", A: "#FF4D5E" } as const,
  fasce: {
    top: "#FFD400", semitop: "#FFA726", titolare: "#3FA7FF",
    scommessa: "#B07CFF", lowcost: "#8FA0BF",
  } as const,
};
export const spacing = (n: number) => n * 4;
export const radius = { sm: 6, md: 10, lg: 16 };
export const fonts = {
  display: "BarlowCondensed_700Bold",
  displaySemi: "BarlowCondensed_600SemiBold",
  body: "Archivo_400Regular",
  bodyMedium: "Archivo_500Medium",
  bodyBold: "Archivo_700Bold",
};
export const FASCIA_LABEL: Record<string, string> = {
  top: "TOP", semitop: "SEMI-TOP", titolare: "TITOLARE",
  scommessa: "SCOMMESSA", lowcost: "LOW COST",
};
