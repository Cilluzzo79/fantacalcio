# App UI "Broadcast" — 5 schermate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire la UI placeholder dell'app con le 5 schermate complete (Lega, Listone, Strategia, Asta live, Riepilogo) in estetica "Broadcast TV", più supporto allenatori opzionale per lega e APK finale via EAS.

**Architecture:** La logica vive già in `src/domain/` (puro) e `src/store/` (zustand persistiti): la UI è uno strato sottile che compone quelle funzioni. Ogni nuova logica testabile nasce in moduli `.ts` puri (jest `testMatch` è ristretto a `*.test.ts`); le schermate sono componenti thin verificati con typecheck + `expo export` + smoke manuale sul dispositivo.

**Tech Stack:** Expo SDK 57, expo-router (root `app/src/app/`), TypeScript strict, zustand + AsyncStorage, Reanimated 4, @expo-google-fonts (Barlow Condensed + Archivo), EAS Build.

**Spec:** `docs/superpowers/specs/2026-08-12-fantacalcio-asta-design.md` (§6 app; §5 Fase B/C algoritmo)

## Global Constraints

- Expo SDK **57**: router root è `app/src/app/` (NON `app/app/`); `expo-file-system` si importa SOLO da `"expo-file-system/legacy"`.
- Jest: `testMatch` copre solo `*.test.ts` → la logica testabile sta in moduli `.ts` puri, MAI dentro i componenti.
- TypeScript strict; `npm run typecheck` deve restare pulito a ogni task.
- **100% offline durante l'asta**: font bundlati (pacchetti @expo-google-fonts), nessun fetch nei flussi d'asta.
- Max **5 leghe** (`MAX_LEAGUES`), slots default `{P:3, D:8, C:8, A:6}`.
- Copy UI in **italiano**.
- Tema **dark-only** "Broadcast TV": navy quasi-nero + giallo elettrico, numeri tabellari (decisione utente 2026-08-14). Font: Barlow Condensed (display/numeri) + Archivo (testo). MAI Inter/Roboto/system di default.
- Navigazione: **5 tab fisse** (Lega · Listone · Strategia · Asta · Riepilogo), selettore lega nell'header (decisione utente 2026-08-14).
- Nuove dipendenze AMMESSE (e nessun'altra): `expo-font`, `@expo-google-fonts/barlow-condensed`, `@expo-google-fonts/archivo`, `expo-document-picker`, `@expo/vector-icons` (già nel template), `eas-cli` (via npx).
- **Note vincolanti dal triage 2a + richieste utente** (tutte coperte da task qui dentro): (1) riparazione valida l'over-allocazione del rosterIniziale; (2) refresh dataset espone un `reason` per l'error surface; (3) input numerici della Home riscritti (bug `parseInt("0")||8`, floor crediti errato); (4) il Listone usa `computeLive` (i prezzi base sono sbagliati in riparazione); (5) sanity: Σ prezzi ≈ monte solo sui giocatori vorp>0; (6) **allenatori opzionali per lega** (toggle, default off).
- Comandi (da `app\`): test `npm test -- --watchAll=false` · typecheck `npm run typecheck` · smoke `npx expo export --platform android`.

## Design tokens (riferimento per TUTTI i task UI)

Palette e tipografia definite nel Task 1 (`src/ui/theme.ts`) e usate ovunque: bg `#0B1220`, surface `#121B2E`, surfaceAlt `#1A2540`, line `#22304F`, testo `#EAF0FA`, testo secondario `#8FA0BF`, accento **giallo `#FFD400`** (testo sopra: navy), ok `#2ECC71`, warn `#FF9F1C`, danger `#FF4D5E`; colori ruolo P `#FFB020` / D `#3FA7FF` / C `#2ECC71` / A `#FF4D5E`; fasce top=giallo, semitop=`#FFA726`, titolare=`#3FA7FF`, scommessa=`#B07CFF`, lowcost=`#8FA0BF`. Numeri sempre `fontVariant: ["tabular-nums"]` in Barlow Condensed Bold. Le informazioni critiche (MAX TUO, budget) sono i numeri più grandi dello schermo.

---

### Task 1: Design system — tokens, font, componenti base

**Files:**
- Create: `src/ui/theme.ts`, `src/ui/parse.ts`, `src/ui/T.tsx`, `src/ui/Button.tsx`, `src/ui/Badge.tsx`, `src/ui/RoleChip.tsx`, `src/ui/Screen.tsx`, `src/ui/NumberField.tsx`
- Modify: `src/app/_layout.tsx` (caricamento font + splash hold)
- Test: `src/ui/__tests__/parse.test.ts`

**Interfaces:**
- Consumes: niente (foglia).
- Produces: `colors`, `spacing(n)`, `radius`, `fonts` da `theme.ts`; `parseIntero(text, {min, max, fallback}): number`; `<T variant="display|number|title|body|label|dim">`; `<Button title onPress variant="primary|ghost|danger" size="md|lg" disabled?>`; `<Badge fascia>` e `<Badge text color>`; `<RoleChip ruolo size?>`; `<Screen header?>` wrapper; `<NumberField label value onChange min max step?>`.

- [ ] **Step 1: Installare le dipendenze**

```powershell
cd D:\railway\fantacalcio\app
npx expo install expo-font @expo-google-fonts/barlow-condensed @expo-google-fonts/archivo expo-document-picker
```

- [ ] **Step 2: Scrivere il test del parser numerico (il fix del bug `parseInt("0")||8`)**

`src/ui/__tests__/parse.test.ts`:
```ts
import { parseIntero } from "../parse";

test("zero esplicito viene clampato al minimo, non sostituito dal fallback", () => {
  expect(parseIntero("0", { min: 2, max: 20, fallback: 8 })).toBe(2);
});

test("stringa vuota o non numerica usa il fallback", () => {
  expect(parseIntero("", { min: 2, max: 20, fallback: 8 })).toBe(8);
  expect(parseIntero("abc", { min: 2, max: 20, fallback: 8 })).toBe(8);
});

test("clamp su max e strip di caratteri spuri", () => {
  expect(parseIntero("500", { min: 1, max: 8, fallback: 4 })).toBe(8);
  expect(parseIntero("1.200", { min: 1, max: 5000, fallback: 500 })).toBe(1200);
  expect(parseIntero("07", { min: 1, max: 99, fallback: 1 })).toBe(7);
});
```

- [ ] **Step 3: Verificare che fallisca** — Run: `npm test -- --watchAll=false parse` · Expected: FAIL (modulo inesistente)

- [ ] **Step 4: Implementare `src/ui/parse.ts`**

```ts
export function parseIntero(text: string,
  opts: { min: number; max: number; fallback: number }): number {
  const digits = text.replace(/[^0-9]/g, "");
  if (digits === "") return opts.fallback;
  const n = parseInt(digits, 10);
  if (Number.isNaN(n)) return opts.fallback;
  return Math.min(opts.max, Math.max(opts.min, n));
}
```

- [ ] **Step 5: Verificare che passi** — Run: `npm test -- --watchAll=false parse` · Expected: PASS

- [ ] **Step 6: Creare `src/ui/theme.ts`**

```ts
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
```

- [ ] **Step 7: Creare `src/ui/T.tsx` (testo tipografico unico dell'app)**

```tsx
import { Text, type TextProps } from "react-native";
import { colors, fonts } from "./theme";

type Variant = "display" | "number" | "title" | "body" | "label" | "dim";

const styles: Record<Variant, object> = {
  display: { fontFamily: fonts.display, fontSize: 30, color: colors.text,
    letterSpacing: 0.5 },
  number: { fontFamily: fonts.display, fontSize: 24, color: colors.text,
    fontVariant: ["tabular-nums"] as const },
  title: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 14, color: colors.text },
  label: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.textDim,
    textTransform: "uppercase" as const, letterSpacing: 1.2 },
  dim: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim },
};

export function T({ variant = "body", style, ...rest }:
  TextProps & { variant?: Variant }) {
  return <Text {...rest} style={[styles[variant], style]} />;
}
```

- [ ] **Step 8: Creare `Button`, `Badge`, `RoleChip`, `Screen`**

`src/ui/Button.tsx`:
```tsx
import { Pressable, type ViewStyle } from "react-native";
import { colors, radius, spacing } from "./theme";
import { T } from "./T";

const variants = {
  primary: { bg: colors.accent, fg: colors.accentText, border: colors.accent },
  ghost: { bg: "transparent", fg: colors.text, border: colors.line },
  danger: { bg: "transparent", fg: colors.danger, border: colors.danger },
};

export function Button({ title, onPress, variant = "primary", size = "md",
  disabled, style }: {
  title: string; onPress(): void;
  variant?: keyof typeof variants; size?: "md" | "lg";
  disabled?: boolean; style?: ViewStyle;
}) {
  const v = variants[variant];
  return (
    <Pressable onPress={onPress} disabled={disabled}
      style={({ pressed }) => [{
        backgroundColor: v.bg, borderColor: v.border, borderWidth: 1,
        borderRadius: radius.md, alignItems: "center", justifyContent: "center",
        paddingVertical: spacing(size === "lg" ? 4 : 2.5),
        paddingHorizontal: spacing(4),
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      }, style]}>
      <T variant={size === "lg" ? "title" : "body"}
        style={{ color: v.fg, fontFamily: "Archivo_700Bold",
          textTransform: "uppercase", letterSpacing: 1 }}>{title}</T>
    </Pressable>
  );
}
```

`src/ui/Badge.tsx`:
```tsx
import { View } from "react-native";
import type { Fascia } from "../domain/types";
import { colors, FASCIA_LABEL, radius, spacing } from "./theme";
import { T } from "./T";

export function Badge({ fascia, text, color }: {
  fascia?: Fascia; text?: string; color?: string;
}) {
  const c = fascia ? colors.fasce[fascia] : (color ?? colors.textDim);
  const label = fascia ? FASCIA_LABEL[fascia] : (text ?? "");
  return (
    <View style={{ borderColor: c, borderWidth: 1, borderRadius: radius.sm,
      paddingHorizontal: spacing(1.5), paddingVertical: 1, alignSelf: "flex-start" }}>
      <T variant="label" style={{ color: c }}>{label}</T>
    </View>
  );
}
```

`src/ui/RoleChip.tsx`:
```tsx
import { View } from "react-native";
import type { Ruolo } from "../domain/types";
import { colors, fonts, radius } from "./theme";
import { T } from "./T";

export function RoleChip({ ruolo, size = 22 }: { ruolo: Ruolo; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: radius.sm,
      backgroundColor: colors.roles[ruolo],
      alignItems: "center", justifyContent: "center" }}>
      <T style={{ fontFamily: fonts.display, fontSize: size * 0.62,
        color: colors.bg }}>{ruolo}</T>
    </View>
  );
}
```

`src/ui/Screen.tsx`:
```tsx
import { View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "./theme";

export function Screen({ children, style, padded = true }: {
  children: React.ReactNode; style?: ViewStyle; padded?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[{ flex: 1, backgroundColor: colors.bg,
      paddingBottom: insets.bottom,
      paddingHorizontal: padded ? spacing(4) : 0 }, style]}>
      {children}
    </View>
  );
}
```

- [ ] **Step 9: Creare `src/ui/NumberField.tsx` (sostituisce gli input rotti della Home)**

```tsx
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
  const bump = (d: number) =>
    onChange(Math.min(max, Math.max(min, value + d * step)));
  return (
    <View style={{ marginBottom: spacing(3) }}>
      <T variant="label" style={{ marginBottom: spacing(1) }}>{label}</T>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing(2) }}>
        <Stepper sign="−" onPress={() => bump(-1)} />
        <TextInput
          value={raw ?? String(value)}
          onChangeText={setRaw}
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
```

- [ ] **Step 10: Caricare i font in `src/app/_layout.tsx`**

Sostituire il contenuto con:
```tsx
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
```
(Se il `_layout.tsx` attuale fa già il boot del dataset, preservarne la logica: il boot deve avvenire una sola volta qui.)

- [ ] **Step 11: Verifica completa** — Run: `npm test -- --watchAll=false` (tutte verdi) · `npm run typecheck` (pulito) · `npx expo export --platform android` (ok)

- [ ] **Step 12: Commit**

```powershell
git add app/src/ui app/src/app/_layout.tsx app/package.json app/package-lock.json
git commit -m "feat(app): design system broadcast - tokens, font, componenti base"
```

---

### Task 2: Domain — sanity prezzi (vorp>0) + validazione rosterIniziale

**Files:**
- Create: `src/domain/roster.ts`
- Modify: `src/domain/__tests__/sanity.test.ts` (proprietà corretta)
- Test: `src/domain/__tests__/roster.test.ts`

**Interfaces:**
- Consumes: `computeLeaguePrices(players, {teams, creditiPerTeam, slots})`, `replacementLevels`, tipi `League`, `Player`, `Ruolo` da `types.ts`.
- Produces: `validateRosterIniziale(input: RosterCheckInput): string[]` (lista problemi, `[]` = valido) con `RosterCheckInput = { league: League; players: Map<number, Player>; teamId: string; roster: { playerId: number; prezzo: number }[]; creditiResidui: number; takenElsewhere: Set<number> }`.

- [ ] **Step 1: Correggere la proprietà di sanity (nota vincolante #5)**

In `src/domain/__tests__/sanity.test.ts`, sostituire l'asserzione "somma prezzi ≈ monte" con l'identità esatta ristretta ai giocatori con vorp>0 (prezzo>1):

```ts
import { computeLeaguePrices, replacementLevels } from "../prices";
import { miniDataset } from "./fixtures";

test("l'extra-monte finisce tutto e solo sui giocatori con vorp>0", () => {
  const players = miniDataset().players;
  const params = { teams: 8, creditiPerTeam: 500,
    slots: { P: 3, D: 8, C: 8, A: 6 } as const };
  const prices = computeLeaguePrices(players, params);
  const repl = replacementLevels(players, params);
  const conVorp = players.filter(p => p.valueScore - repl[p.ruolo] > 0);
  const extraDistribuito = conVorp
    .reduce((a, p) => a + (prices.get(p.id)! - 1), 0);
  const monte = params.teams * params.creditiPerTeam;
  const minSpend = params.teams * (3 + 8 + 8 + 6);
  // identità: Σ(prezzo-1) sui vorp>0 == monte - minSpend, a meno di arrotondamenti
  expect(Math.abs(extraDistribuito - (monte - minSpend)))
    .toBeLessThanOrEqual(Math.max(1, conVorp.length * 0.5));
  // e chi non ha vorp vale esattamente 1
  for (const p of players) {
    if (p.valueScore - repl[p.ruolo] <= 0) expect(prices.get(p.id)).toBe(1);
  }
});
```
Mantenere gli altri test del file già verdi (nessun prezzo < 1, ordinamento coerente col VORP).

- [ ] **Step 2: Run** `npm test -- --watchAll=false sanity` — se la vecchia asserzione era diversa deve ora fallire o passare per il motivo giusto; sistemare finché PASS con la nuova proprietà.

- [ ] **Step 3: Test della validazione riparazione (nota vincolante #1)**

`src/domain/__tests__/roster.test.ts`:
```ts
import { validateRosterIniziale } from "../roster";
import { miniDataset } from "./fixtures";
import type { League } from "../types";

const players = new Map(miniDataset().players.map(p => [p.id, p]));
const pByRole = (r: string) =>
  [...players.values()].filter(p => p.ruolo === r).map(p => p.id);

function mkLeague(): League {
  return {
    id: "L1", nome: "Test", slots: { P: 1, D: 2, C: 2, A: 1 },
    teams: [
      { id: "t1", nome: "Io", crediti: 100, rosterIniziale: [] },
      { id: "t2", nome: "Avv", crediti: 100, rosterIniziale: [] },
    ],
    myTeamIndex: 0, createdAt: "2026-08-14T00:00:00Z",
  };
}

test("roster valido: nessun problema", () => {
  const [d1] = pByRole("D");
  const out = validateRosterIniziale({
    league: mkLeague(), players, teamId: "t1",
    roster: [{ playerId: d1, prezzo: 10 }],
    creditiResidui: 50, takenElsewhere: new Set(),
  });
  expect(out).toEqual([]);
});

test("over-allocazione di ruolo segnalata", () => {
  const [d1, d2, d3] = pByRole("D");
  const out = validateRosterIniziale({
    league: mkLeague(), players, teamId: "t1",
    roster: [d1, d2, d3].map(id => ({ playerId: id, prezzo: 1 })),
    creditiResidui: 50, takenElsewhere: new Set(),
  });
  expect(out.some(p => p.includes("D"))).toBe(true); // 3 D su slot 2
});

test("giocatore già preso da un'altra squadra, duplicati e residui insufficienti", () => {
  const [d1] = pByRole("D");
  const league = mkLeague();
  const out = validateRosterIniziale({
    league, players, teamId: "t1",
    roster: [{ playerId: d1, prezzo: 10 }, { playerId: d1, prezzo: 5 }],
    creditiResidui: 2, takenElsewhere: new Set([d1]),
  });
  expect(out.some(p => p.includes("duplicat"))).toBe(true);
  expect(out.some(p => p.includes("altra squadra"))).toBe(true);
  // slot liberi = 6 totali - 2 occupati... residui 2 < slot vuoti rimanenti
  expect(out.some(p => p.includes("crediti"))).toBe(true);
});
```

- [ ] **Step 4: Run** `npm test -- --watchAll=false roster` — Expected: FAIL (modulo inesistente)

- [ ] **Step 5: Implementare `src/domain/roster.ts`**

```ts
import type { League, Player, Ruolo } from "./types";

const RUOLI: Ruolo[] = ["P", "D", "C", "A"];

export interface RosterCheckInput {
  league: League;
  players: Map<number, Player>;
  teamId: string;
  roster: { playerId: number; prezzo: number }[];
  creditiResidui: number;
  takenElsewhere: Set<number>; // playerId già nei roster delle ALTRE squadre
}

export function validateRosterIniziale(input: RosterCheckInput): string[] {
  const { league, players, roster, creditiResidui, takenElsewhere } = input;
  const problemi: string[] = [];
  const visti = new Set<number>();
  const perRuolo: Record<Ruolo, number> = { P: 0, D: 0, C: 0, A: 0 };

  for (const r of roster) {
    const pl = players.get(r.playerId);
    if (!pl) { problemi.push(`giocatore sconosciuto (id ${r.playerId})`); continue; }
    if (visti.has(r.playerId)) problemi.push(`${pl.nome}: duplicato nel roster`);
    visti.add(r.playerId);
    if (takenElsewhere.has(r.playerId))
      problemi.push(`${pl.nome}: già in un'altra squadra`);
    if (r.prezzo < 1) problemi.push(`${pl.nome}: prezzo minimo 1`);
    perRuolo[pl.ruolo] += 1;
  }
  let slotVuoti = 0;
  for (const ruolo of RUOLI) {
    if (perRuolo[ruolo] > league.slots[ruolo])
      problemi.push(
        `troppi ${ruolo}: ${perRuolo[ruolo]}/${league.slots[ruolo]}`);
    slotVuoti += Math.max(0, league.slots[ruolo] - perRuolo[ruolo]);
  }
  if (creditiResidui < 0) problemi.push("crediti residui negativi");
  else if (creditiResidui < slotVuoti)
    problemi.push(
      `crediti residui insufficienti: ${creditiResidui} per ${slotVuoti} slot vuoti (serve ≥1 a slot)`);
  return problemi;
}
```

- [ ] **Step 6: Run** `npm test -- --watchAll=false` — Expected: PASS tutte

- [ ] **Step 7: Commit**

```powershell
git add app/src/domain/roster.ts app/src/domain/__tests__/roster.test.ts app/src/domain/__tests__/sanity.test.ts
git commit -m "feat(app): validazione roster riparazione + sanity prezzi su vorp>0"
```

---

### Task 3: Domain + store — allenatori opzionali per lega

**Files:**
- Modify: `src/domain/types.ts` (League.useCoaches, Dataset.allenatori, AuctionState.coaches, tipo Coach/CoachPurchase), `src/domain/dataset.ts` (parse allenatori), `src/domain/auction.ts` (teamSummary con spesa/riserva allenatore), `src/store/leagues.ts` (patch useCoaches), `src/store/auctions.ts` (azioni coach)
- Create: `src/domain/coach.ts`
- Test: `src/domain/__tests__/coach.test.ts` + estensioni in `src/domain/__tests__/dataset.test.ts`

**Interfaces:**
- Consumes: `teamSummary`, `newId()`, `parseDataset`, store esistenti.
- Produces:
  - `types.ts`: `interface Coach { nome: string; squadra: string; qta: number }`; `Dataset.allenatori?: Coach[]`; `League.useCoaches?: boolean`; `interface CoachPurchase { id: string; teamId: string; nome: string; squadra: string; prezzo: number; ts: string }`; `AuctionState.coaches?: CoachPurchase[]`.
  - `coach.ts`: `registerCoach(state, league, players, c: { teamId; nome; squadra; prezzo }, opts?: { force?: boolean }): AuctionState` · `removeCoach(state, coachId): AuctionState` · `coachOf(state, teamId): CoachPurchase | undefined` · `maxCoachOfferta(state, league, players, teamId): number`.
  - `teamSummary` ritorna in più: `coachSpesa: number`, `needCoach: boolean` (e li conteggia in `spesi`/`residui`/`maxOfferta`: se `league.useCoaches` e la squadra non ha allenatore, riserva 1 credito extra).
  - store `auctions`: `purchaseCoach(leagueId, league, players, c, opts?)`, `removeCoach(leagueId, coachId)`.
  - store `leagues`: `updateLeague` accetta anche `useCoaches` nel patch (`Partial<Pick<League, "nome" | "slots" | "myTeamIndex" | "useCoaches">>`).

- [ ] **Step 1: Test dominio allenatori**

`src/domain/__tests__/coach.test.ts`:
```ts
import { emptyAuction, teamSummary } from "../auction";
import { registerCoach, removeCoach, coachOf, maxCoachOfferta } from "../coach";
import { miniDataset } from "./fixtures";
import type { League } from "../types";

const players = new Map(miniDataset().players.map(p => [p.id, p]));

function mkLeague(useCoaches = true): League {
  return {
    id: "L1", nome: "Test", slots: { P: 1, D: 1, C: 1, A: 1 },
    teams: [
      { id: "t1", nome: "Io", crediti: 50, rosterIniziale: [] },
      { id: "t2", nome: "Avv", crediti: 50, rosterIniziale: [] },
    ],
    myTeamIndex: 0, createdAt: "2026-08-14T00:00:00Z", useCoaches,
  };
}
const chivu = { teamId: "t1", nome: "CHIVU", squadra: "Inter", prezzo: 20 };

test("registerCoach felice: spesa contata nel summary, needCoach si spegne", () => {
  const league = mkLeague();
  let state = emptyAuction("L1");
  expect(teamSummary(state, league, players, "t1").needCoach).toBe(true);
  state = registerCoach(state, league, players, chivu);
  expect(coachOf(state, "t1")?.nome).toBe("CHIVU");
  const sum = teamSummary(state, league, players, "t1");
  expect(sum.coachSpesa).toBe(20);
  expect(sum.residui).toBe(30);
  expect(sum.needCoach).toBe(false);
});

test("lega senza allenatori: registerCoach rifiuta e il summary non riserva nulla", () => {
  const league = mkLeague(false);
  expect(() => registerCoach(emptyAuction("L1"), league, players, chivu))
    .toThrow(/non usa gli allenatori/);
  expect(teamSummary(emptyAuction("L1"), league, players, "t1").needCoach)
    .toBe(false);
});

test("un allenatore per squadra, niente doppioni tra squadre", () => {
  const league = mkLeague();
  let state = registerCoach(emptyAuction("L1"), league, players, chivu);
  expect(() => registerCoach(state, league, players,
    { teamId: "t1", nome: "ALLEGRI", squadra: "Napoli", prezzo: 5 }))
    .toThrow(/ha già un allenatore/);
  expect(() => registerCoach(state, league, players,
    { teamId: "t2", nome: "CHIVU", squadra: "Inter", prezzo: 5 }))
    .toThrow(/già acquistato/);
  state = removeCoach(state, state.coaches![0].id);
  expect(coachOf(state, "t1")).toBeUndefined();
});

test("budget: maxCoachOfferta riserva 1 credito per ogni slot giocatore vuoto", () => {
  const league = mkLeague();
  const state = emptyAuction("L1");
  // 50 crediti, 4 slot giocatore vuoti -> max allenatore 46
  expect(maxCoachOfferta(state, league, players, "t1")).toBe(46);
  expect(() => registerCoach(state, league, players, { ...chivu, prezzo: 47 }))
    .toThrow(/crediti/);
  // force scavalca
  const forced = registerCoach(state, league, players,
    { ...chivu, prezzo: 47 }, { force: true });
  expect(forced.coaches).toHaveLength(1);
});

test("la riserva allenatore abbassa maxOfferta giocatori di 1", () => {
  const conCoach = teamSummary(emptyAuction("L1"), mkLeague(true), players, "t1");
  const senza = teamSummary(emptyAuction("L1"), mkLeague(false), players, "t1");
  expect(senza.maxOfferta - conCoach.maxOfferta).toBe(1);
});
```

Estensione `src/domain/__tests__/dataset.test.ts` (chiave `allenatori`):
```ts
test("parseDataset accetta e valida la chiave opzionale allenatori", () => {
  const base = miniDataset() as any;
  expect(parseDataset(base)).toBeTruthy(); // senza chiave: ok
  base.allenatori = [{ nome: "CHIVU", squadra: "Inter", qta: 30 }];
  expect(parseDataset(base).allenatori).toHaveLength(1);
  base.allenatori = [{ nome: "CHIVU" }]; // malformato
  expect(() => parseDataset(base)).toThrow(/allenatori/);
});
```

- [ ] **Step 2: Run** `npm test -- --watchAll=false coach dataset` — Expected: FAIL (tipi e modulo mancanti)

- [ ] **Step 3: Estendere `types.ts`**

Aggiungere (senza toccare il resto):
```ts
export interface Coach { nome: string; squadra: string; qta: number; }
export interface CoachPurchase {
  id: string; teamId: string; nome: string; squadra: string;
  prezzo: number; ts: string;
}
```
In `Dataset`: `allenatori?: Coach[];` · In `League`: `useCoaches?: boolean;` · In `AuctionState`: `coaches?: CoachPurchase[];`

- [ ] **Step 4: `dataset.ts` — validare la chiave opzionale**

In `parseDataset`, dopo il check players:
```ts
if (d.allenatori !== undefined) {
  if (!Array.isArray(d.allenatori)) fail("allenatori non è un array");
  d.allenatori.forEach((c: any, i: number) => {
    if (typeof c?.nome !== "string" || typeof c?.squadra !== "string"
      || typeof c?.qta !== "number")
      fail(`allenatori[${i}] malformato`);
  });
}
```

- [ ] **Step 5: `auction.ts` — teamSummary con allenatore**

Dentro `teamSummary`, dopo il calcolo di `spesi`:
```ts
const coachSpesa = (state.coaches ?? [])
  .filter(c => c.teamId === teamId).reduce((a, c) => a + c.prezzo, 0);
const residui = team.crediti - spesi - coachSpesa;
```
E dopo `slotTot`:
```ts
const needCoach = league.useCoaches === true
  && !(state.coaches ?? []).some(c => c.teamId === teamId);
const maxOfferta = Math.max(0,
  residui - Math.max(0, slotTot + (needCoach ? 1 : 0) - 1));
```
Aggiungere `coachSpesa, needCoach` all'oggetto ritornato (il vecchio `residui = team.crediti - spesi` va sostituito, non duplicato).

- [ ] **Step 6: Creare `src/domain/coach.ts`**

```ts
import type { AuctionState, CoachPurchase, League, Player } from "./types";
import { AuctionError, teamSummary } from "./auction";
import { newId } from "./ids";

export function coachOf(state: AuctionState, teamId: string):
  CoachPurchase | undefined {
  return (state.coaches ?? []).find(c => c.teamId === teamId);
}

export function maxCoachOfferta(state: AuctionState, league: League,
  players: Map<number, Player>, teamId: string): number {
  const sum = teamSummary(state, league, players, teamId);
  const slotVuoti = (["P", "D", "C", "A"] as const)
    .reduce((a, r) => a + Math.max(0, sum.slotLiberi[r]), 0);
  return Math.max(0, sum.residui - slotVuoti);
}

export function registerCoach(state: AuctionState, league: League,
  players: Map<number, Player>,
  c: { teamId: string; nome: string; squadra: string; prezzo: number },
  opts?: { force?: boolean }): AuctionState {
  if (league.useCoaches !== true)
    throw new AuctionError("questa lega non usa gli allenatori");
  if (coachOf(state, c.teamId))
    throw new AuctionError("la squadra ha già un allenatore");
  if ((state.coaches ?? []).some(x => x.nome === c.nome && x.squadra === c.squadra))
    throw new AuctionError("allenatore già acquistato");
  if (c.prezzo < 1) throw new AuctionError("prezzo minimo 1");
  if (!opts?.force && c.prezzo > maxCoachOfferta(state, league, players, c.teamId))
    throw new AuctionError("crediti insufficienti per l'allenatore");
  const purchase: CoachPurchase = {
    id: newId(), ...c, ts: new Date().toISOString(),
  };
  return { ...state, coaches: [...(state.coaches ?? []), purchase] };
}

export function removeCoach(state: AuctionState, coachId: string): AuctionState {
  return { ...state, coaches: (state.coaches ?? []).filter(c => c.id !== coachId) };
}
```

- [ ] **Step 7: Store — `auctions.ts` e `leagues.ts`**

`auctions.ts`: importare `registerCoach, removeCoach` da `../domain/coach` e aggiungere all'interfaccia e all'implementazione:
```ts
purchaseCoach(leagueId: string, league: League, players: Map<number, Player>,
  c: { teamId: string; nome: string; squadra: string; prezzo: number },
  opts?: { force?: boolean }): void;
removeCoach(leagueId: string, coachId: string): void;
```
implementate come `purchase`/`remove` (leggi `getAuction`, applica la funzione di dominio, `set` su `byLeague`).

`leagues.ts`: cambiare la firma di `updateLeague` in
`updateLeague(id: string, patch: Partial<Pick<League, "nome" | "slots" | "myTeamIndex" | "useCoaches">>): void` (l'implementazione a spread già lo gestisce).

- [ ] **Step 8: Run** `npm test -- --watchAll=false` — Expected: PASS tutte (comprese le suite esistenti: nessuna regressione su `auction.test.ts`)

- [ ] **Step 9: Typecheck** `npm run typecheck` — pulito

- [ ] **Step 10: Commit**

```powershell
git add app/src/domain app/src/store
git commit -m "feat(app): allenatori opzionali per lega - dominio, dataset, store"
```

---

### Task 4: Dataset — error surface con reason + import manuale

**Files:**
- Modify: `src/store/dataset.ts` (lastError/lastChecked), `src/services/datasetService.ts` (reason espliciti)
- Create: `src/services/importDataset.ts` (glue expo-document-picker)
- Test: estendere `src/store/__tests__/dataset.test.ts`

**Interfaces:**
- Consumes: `refreshDataset`, `importDatasetFromText`, `isStale` da datasetService; `Deps`.
- Produces: store `useDataset` con in più `lastError: string | null` e `lastChecked: string | null` (ISO dell'ultimo tentativo riuscito o no); `refresh()` azzera `lastError` in caso di successo e lo valorizza col motivo in caso di errore; `importFromDevice(): Promise<"ok" | "annullato">` in `importDataset.ts` che apre il picker, legge il file e chiama `importDatasetFromText` + aggiorna lo store.

- [ ] **Step 1: Test (nota vincolante #2)** — aggiungere a `src/store/__tests__/dataset.test.ts`:

```ts
test("refresh fallito espone un reason leggibile e non azzera il dataset", async () => {
  // deps con fetch che lancia (offline)
  const deps = {
    fetchFn: (() => { throw new Error("network request failed"); }) as any,
    readFile: async () => null,
    writeFile: async () => {},
  };
  useDataset.setState({ dataset: miniDataset(), status: "ready", lastError: null });
  const updated = await useDataset.getState().refresh(deps);
  expect(updated).toBe(false);
  expect(useDataset.getState().dataset).not.toBeNull();
  expect(useDataset.getState().lastError).toMatch(/offline|rete|network/i);
});

test("refresh riuscito azzera lastError e aggiorna lastChecked", async () => {
  const ds = miniDataset();
  const deps = {
    fetchFn: (async () => ({ ok: true, json: async () => ds })) as any,
    readFile: async () => null,
    writeFile: async () => {},
  };
  useDataset.setState({ dataset: null, status: "loading",
    lastError: "vecchio errore" });
  await useDataset.getState().refresh(deps);
  expect(useDataset.getState().lastError).toBeNull();
  expect(useDataset.getState().lastChecked).toBeTruthy();
});
```
(Adattare le asserzioni alle utility di test già presenti nel file — fixture `miniDataset` è in `src/domain/__tests__/fixtures.ts`.)

- [ ] **Step 2: Run** — Expected: FAIL (`lastError` non esiste)

- [ ] **Step 3: Implementare**

`datasetService.ts`: in `refreshDataset`, trasformare i fallimenti di rete in messaggi leggibili invece di inghiottirli quando il chiamante vuole il reason. Firma invariata, ma il `catch` interno diventa:
```ts
let fetchErrorReason: string | null = null;
try {
  const res = await deps.fetchFn(DATASET_URL);
  if (res.ok) remote = parseDataset(await res.json());
  else fetchErrorReason = `il server ha risposto ${res.status}`;
} catch (e) {
  fetchErrorReason = e instanceof DatasetError
    ? `dataset remoto non valido: ${e.message}`
    : "sei offline o la rete non risponde";
}
```
e in coda, se non c'è `remote` ma c'è `current`, ritornare `{ dataset: current, updated: false, reason: fetchErrorReason }` (aggiungere `reason?: string | null` al tipo di ritorno). Se non c'è nulla: `throw new DatasetError(fetchErrorReason ?? "nessun dataset disponibile: scarica o importa il file")`.

`store/dataset.ts`: aggiungere `lastError: string | null` e `lastChecked: string | null` allo stato (iniziali `null`); in `refresh`:
```ts
async refresh(deps) {
  const { dataset } = get();
  try {
    const res = await refreshDataset(dataset, deps);
    set({ dataset: res.dataset, status: "ready",
      lastError: res.reason ?? null,
      lastChecked: new Date().toISOString() });
    return res.updated;
  } catch (e) {
    set({ lastError: e instanceof Error ? e.message : "errore sconosciuto",
      lastChecked: new Date().toISOString(),
      ...(get().dataset ? {} : { status: "missing" as const }) });
    return false;
  }
}
```
`boot` analogo: on-catch valorizza `lastError`.

`src/services/importDataset.ts`:
```ts
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
```

- [ ] **Step 4: Run** `npm test -- --watchAll=false` + `npm run typecheck` — PASS/pulito

- [ ] **Step 5: Commit**

```powershell
git add app/src/store/dataset.ts app/src/services
git commit -m "feat(app): reason sugli errori dataset + import manuale da file"
```

---

### Task 5: Shell di navigazione — 5 tab + selettore lega

**Files:**
- Create: `src/components/LeagueSwitcher.tsx`, `src/app/(tabs)/strategia.tsx`, `src/app/(tabs)/asta.tsx`, `src/app/(tabs)/riepilogo.tsx` (placeholder minimi che i task 8-11 riempiono)
- Modify: `src/app/(tabs)/_layout.tsx` (5 tab, tema broadcast, header col selettore), `app.json` (nome "FantAsta", colori dark)
- Test: nessun jest (solo shell) — verifica: typecheck + export

**Interfaces:**
- Consumes: `useLeagues` (`leagues`, `activeLeagueId`, `setActiveLeague`), tokens `theme.ts`, `T`, icone `@expo/vector-icons` (Ionicons).
- Produces: `<LeagueSwitcher />` (bottone header: nome lega attiva + ▾ → modal di scelta tra le leghe + voce "Gestisci leghe" che porta alla tab Lega); layout tab con route `index` (titolo tab "Lega", icona `shield-half`), `listone` (`list`), `strategia` (`pie-chart`), `asta` (`flash`), `riepilogo` (`podium`).

- [ ] **Step 1: `LeagueSwitcher`**

```tsx
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
```

- [ ] **Step 2: Riscrivere `src/app/(tabs)/_layout.tsx`**

```tsx
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LeagueSwitcher } from "../../components/LeagueSwitcher";
import { colors, fonts } from "../../ui/theme";

const icon = (name: keyof typeof Ionicons.glyphMap) =>
  ({ color, size }: { color: string; size: number }) =>
    <Ionicons name={name} size={size} color={color} />;

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
```

- [ ] **Step 3: Placeholder delle 3 nuove tab** — per ciascuna di `strategia.tsx`, `asta.tsx`, `riepilogo.tsx`:

```tsx
import { Screen } from "../../ui/Screen";
import { T } from "../../ui/T";

export default function Placeholder() {
  return (
    <Screen>
      <T variant="dim" style={{ marginTop: 24 }}>In costruzione…</T>
    </Screen>
  );
}
```
(rinominare il componente per file: `Strategia`, `Asta`, `Riepilogo`).

- [ ] **Step 4: `app.json`** — impostare `"name": "FantAsta"`, `"backgroundColor": "#0B1220"`, per Android `"navigationBar"/"backgroundColor"` coerenti se già presenti chiavi simili; NON toccare slug/scheme se già valorizzati.

- [ ] **Step 5: Verifica** — `npm run typecheck` pulito · `npx expo export --platform android` ok · `npm test -- --watchAll=false` verde (nessun test toccato)

- [ ] **Step 6: Commit**

```powershell
git add app/src/app app/src/components app/app.json
git commit -m "feat(app): shell 5 tab broadcast con selettore lega"
```

---

### Task 6: Schermata Lega — form, riparazione validata, dataset banner

**Files:**
- Create: `src/components/DatasetBanner.tsx`, `src/components/TeamRosterEditor.tsx`
- Modify: `src/app/(tabs)/index.tsx` (riscrittura completa — rimuovere gli input col bug `parseInt("0")||8` e il floor crediti)
- Test: nessuno nuovo (la logica è nei moduli già testati: `roster.ts`, `parse.ts`, store)

**Interfaces:**
- Consumes: `useLeagues` (tutte le azioni), `useDataset` (`dataset`, `status`, `lastError`, `lastChecked`, `refresh`), `useAuctions.getAuction`, `isStale(ds, nowIso)`, `importFromDevice()`, `validateRosterIniziale`, `NumberField`, `Button`, `Badge`, `RoleChip`, `queryListone` NON serve qui (il picker giocatori usa un filtro semplice sul nome con `normalizeSearch` del Task 7 — vedi Interfaces del Task 7; se il Task 7 non è ancora eseguito, definire qui `normalizeSearch` è VIETATO: usare `.toLowerCase().includes` provvisorio è ammesso SOLO dietro TODO? NO — ordine dei task: il Task 7 crea `listoneQuery.ts` PRIMA della parte riparazione; eseguire Task 6 dopo Task 7 se si vuole il picker con ricerca accent-insensitive, altrimenti usare `p.nome.toLowerCase().includes(q.toLowerCase())` che per i nomi TUTTI MAIUSCOLI del listone Gazzetta è sufficiente e resta così).
- Produces: schermata Lega completa; `<DatasetBanner />` riusabile (usata anche in Asta); `<TeamRosterEditor league team onSave />` per la riparazione.

**Comportamento richiesto (spec §6.2.1 + note vincolanti):**
1. Lista leghe (max 5) con attiva evidenziata; crea/rinomina/elimina (conferma per elimina: `Alert.alert` con distruttiva).
2. Form creazione: nome lega, numero squadre (2-20, `NumberField`), crediti per squadra (1-5000, `NumberField`), slots per ruolo (4 `NumberField` min 0 max 15), nomi squadre (lista di `TextInput` precompilati "Squadra N"), scelta "la mia squadra" (chip selezionabile), toggle **"Usa allenatori"** (`Switch` → `updateLeague(id, { useCoaches })`; default off).
3. **Modalità riparazione** per lega esistente: per ogni squadra un `TeamRosterEditor` che permette di aggiungere giocatori (picker con ricerca sul dataset), prezzo pagato (`NumberField` min 1), crediti residui (`NumberField` min 0); al salvataggio chiama `validateRosterIniziale` con `takenElsewhere` = id già nei roster delle altre squadre e mostra i problemi in rosso SOPRA il bottone salva; salva solo se `[]` → `setTeamRoster(leagueId, teamId, roster, creditiResidui)`.
4. `<DatasetBanner />`: riga compatta con `generatedAt` formattata, stato (`ready`/`missing`), avviso giallo se `isStale(ds, new Date().toISOString())` ("dataset più vecchio di 30 giorni"), riga rossa con `lastError` se presente, bottoni "Aggiorna" (chiede conferma con `Alert` se un'asta ha acquisti: `Object.values(useAuctions.getState().byLeague).some(a => a.purchases.length > 0)`) e "Importa file" (`importFromDevice`).

- [ ] **Step 1: Implementare `DatasetBanner`** (come da comportamento 4; layout: `View` bordo `colors.line`, fondo `surface`, testo `dim`, warning `colors.warn`, errore `colors.danger`)
- [ ] **Step 2: Implementare `TeamRosterEditor`** (come da comportamento 3; lista righe `RoleChip + nome + prezzo` con rimozione; picker = `Modal` con `TextInput` di ricerca + `FlatList` dei primi 30 match non già presi)
- [ ] **Step 3: Riscrivere `index.tsx`** componendo 1+2+3+4; stato locale del form con `useState`, niente logica di parsing inline (SOLO `NumberField`)
- [ ] **Step 4: Verifica** — typecheck pulito; `npm test` verde; `npx expo export --platform android` ok
- [ ] **Step 5: Commit** — `git add app/src && git commit -m "feat(app): schermata Lega con riparazione validata e dataset banner"`

---

### Task 7: Listone — query testata, lista, filtri, dettaglio giocatore

**Files:**
- Create: `src/domain/listoneQuery.ts`, `src/components/PlayerRow.tsx`, `src/app/player/[id].tsx`
- Modify: `src/app/(tabs)/listone.tsx` (riscrittura completa)
- Test: `src/domain/__tests__/listoneQuery.test.ts`

**Interfaces:**
- Consumes: `computeLive(players, league, auction)` → `LiveContext.adjustedPrice(id)` (nota vincolante #4: MAI i prezzi base), `useDataset`, `useLeagues`, `useAuctions.getAuction`, UI kit.
- Produces:
  - `listoneQuery.ts`: `normalizeSearch(s: string): string` (minuscole + rimozione accenti); `interface ListoneFilter { text: string; ruolo: Ruolo | null; squadra: string | null; fascia: Fascia | null; sort: "equo" | "qta" | "aff" }`; `queryListone(players: Player[], f: ListoneFilter, prezzo: (id: number) => number): Player[]` (filtra e ordina decrescente per la chiave scelta).
  - `<PlayerRow player prezzo onPress venduto? />` riga compatta (RoleChip, nome, squadra, Badge fascia, prezzo grande a destra in giallo, opacità 0.4 + tag "VENDUTO" se venduto).
  - Route dettaglio `player/[id]` (fuori dalle tab, push dallo Stack root).

- [ ] **Step 1: Test `listoneQuery`**

```ts
import { normalizeSearch, queryListone } from "../listoneQuery";
import { miniDataset } from "./fixtures";

test("normalizeSearch è accent/case-insensitive", () => {
  expect(normalizeSearch("CANDÈ")).toBe("cande");
  expect(normalizeSearch("  Martínez ")).toBe("martinez");
});

test("filtra per testo+ruolo e ordina per prezzo decrescente", () => {
  const players = miniDataset().players;
  const prezzo = (id: number) => id % 100; // prezzo finto deterministico
  const out = queryListone(players,
    { text: "", ruolo: "D", squadra: null, fascia: null, sort: "equo" }, prezzo);
  expect(out.every(p => p.ruolo === "D")).toBe(true);
  for (let i = 1; i < out.length; i++)
    expect(prezzo(out[i - 1].id)).toBeGreaterThanOrEqual(prezzo(out[i].id));
});

test("sort qta e affidabilità", () => {
  const players = miniDataset().players;
  const byQta = queryListone(players,
    { text: "", ruolo: null, squadra: null, fascia: null, sort: "qta" }, () => 1);
  for (let i = 1; i < byQta.length; i++)
    expect(byQta[i - 1].qta).toBeGreaterThanOrEqual(byQta[i].qta);
});
```

- [ ] **Step 2: Run** — FAIL (modulo mancante)

- [ ] **Step 3: Implementare `listoneQuery.ts`**

```ts
import type { Fascia, Player, Ruolo } from "./types";

export function normalizeSearch(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export interface ListoneFilter {
  text: string; ruolo: Ruolo | null; squadra: string | null;
  fascia: Fascia | null; sort: "equo" | "qta" | "aff";
}

export function queryListone(players: Player[], f: ListoneFilter,
  prezzo: (id: number) => number): Player[] {
  const q = normalizeSearch(f.text);
  const out = players.filter(p =>
    (!q || normalizeSearch(p.nome).includes(q))
    && (!f.ruolo || p.ruolo === f.ruolo)
    && (!f.squadra || p.squadra === f.squadra)
    && (!f.fascia || p.fascia === f.fascia));
  const key: (p: Player) => number =
    f.sort === "qta" ? p => p.qta
    : f.sort === "aff" ? p => p.affidabilita
    : p => prezzo(p.id);
  return [...out].sort((a, b) => key(b) - key(a));
}
```

- [ ] **Step 4: Run** — PASS

- [ ] **Step 5: `listone.tsx`** — comportamento: se `status === "missing"` → empty state con rimando alla tab Lega; se nessuna lega → prezzi nascosti con hint "Crea una lega per vedere i prezzi" (lista comunque consultabile ordinata per `qta`); altrimenti `const live = useMemo(() => computeLive(dataset.players, league, auction), [dataset, league, auction])` e `prezzo = live.adjustedPrice`. Barra ricerca (`TextInput` stile NumberField ma testo), riga di chip filtro ruolo (P/D/C/A toggle), chip fascia, dropdown squadra (Modal semplice con l'elenco `[...new Set(players.map(p => p.squadra))].sort()`), segmento sort (EQUO/QTA/AFF). `FlatList` di `PlayerRow` (max ~600 righe: usare `getItemLayout` con altezza fissa 56 e `initialNumToRender={20}`). Tap riga → `router.push(\`/player/\${p.id}\`)`. Se `league.useCoaches` e `dataset.allenatori`: sezione "ALLENATORI" in coda (toggle chip "ALL") con righe nome/squadra/qta.

- [ ] **Step 6: `player/[id].tsx`** — dettaglio: header con nome `variant="display"`, RoleChip, squadra, Badge fascia + badge affidabilità (colore: ≥80 ok, ≥50 warn, <50 danger); riquadro prezzi (EQUO live grande in giallo; qta e fvm piccoli); sezione "PERCHÉ" = `player.note` come bullet; sezione "TRATTI" = `player.traits` come Badge; tabella stagioni (`player.seasons`: colonne stagione, torneo, PG, gol, assist, rating — per i portieri golSubiti/cleanSheet/rigParati quando non null; righe con coeff ≠ 1 mostrano "×coeff" in dim). Registrare la route nel root `Stack` con `headerShown: true`, `headerStyle` navy, back di default.

- [ ] **Step 7: Verifica** — typecheck + test + export ok

- [ ] **Step 8: Commit** — `git add app/src && git commit -m "feat(app): listone con prezzi live, filtri e dettaglio giocatore"`

---

### Task 8: Strategia — suggerimento budget, target, avvisi

**Files:**
- Create: `src/domain/strategy.ts`, `src/store/strategy.ts`
- Modify: `src/app/(tabs)/strategia.tsx` (riscrittura)
- Test: `src/domain/__tests__/strategy.test.ts`, estensione `src/store/__tests__/persistence.test.ts` (round-trip del nuovo store)

**Interfaces:**
- Consumes: `computeLeaguePrices`, `League`, `Player`, `useLeagues`, `useDataset`, UI kit.
- Produces:
  - `strategy.ts`: `suggestBudgetSplit(players: Player[], league: League): Record<Ruolo, number>` (somma esatta = crediti della MIA squadra; ogni ruolo ≥ slots[r]); `targetWarnings(alloc: Record<Ruolo, number>, targets: { playerId: number; prezzo: number }[], players: Map<number, Player>): string[]` (per ogni ruolo con Σ prezzi target > alloc: "Target D: 95 su 80 allocati").
  - `store/strategy.ts`: zustand persistito `"fanta-strategy"` con `byLeague: Record<string, { alloc: Record<Ruolo, number>; targets: { playerId: number; prezzo: number }[] }>` e azioni `setAlloc(leagueId, alloc)`, `addTarget(leagueId, playerId, prezzo)`, `setTargetPrice(leagueId, playerId, prezzo)`, `removeTarget(leagueId, playerId)`, `getStrategy(leagueId)` (default `{ alloc: null, targets: [] }` → la UI usa `alloc ?? suggestBudgetSplit(...)`; tipare `alloc: Record<Ruolo, number> | null`).

- [ ] **Step 1: Test `strategy.ts`**

```ts
import { suggestBudgetSplit, targetWarnings } from "../strategy";
import { miniDataset } from "./fixtures";
import type { League } from "../types";

const league: League = {
  id: "L1", nome: "Test", slots: { P: 3, D: 8, C: 8, A: 6 },
  teams: [
    { id: "t1", nome: "Io", crediti: 500, rosterIniziale: [] },
    { id: "t2", nome: "A", crediti: 500, rosterIniziale: [] },
  ],
  myTeamIndex: 0, createdAt: "2026-08-14T00:00:00Z",
};

test("il suggerimento somma esattamente al budget e rispetta i minimi", () => {
  const out = suggestBudgetSplit(miniDataset().players, league);
  expect(out.P + out.D + out.C + out.A).toBe(500);
  (["P", "D", "C", "A"] as const)
    .forEach(r => expect(out[r]).toBeGreaterThanOrEqual(league.slots[r]));
});

test("targetWarnings segnala il ruolo che sfora", () => {
  const players = new Map(miniDataset().players.map(p => [p.id, p]));
  const unA = [...players.values()].find(p => p.ruolo === "A")!;
  const warns = targetWarnings({ P: 50, D: 100, C: 150, A: 10 },
    [{ playerId: unA.id, prezzo: 99 }], players);
  expect(warns.some(w => w.includes("A"))).toBe(true);
});
```

- [ ] **Step 2: Run** — FAIL · **Step 3: Implementare**

```ts
import type { League, Player, Ruolo } from "./types";
import { computeLeaguePrices } from "./prices";

const RUOLI: Ruolo[] = ["P", "D", "C", "A"];

export function suggestBudgetSplit(players: Player[],
  league: League): Record<Ruolo, number> {
  const creditiMedi = league.teams.reduce((a, t) => a + t.crediti, 0)
    / league.teams.length;
  const prices = computeLeaguePrices(players, {
    teams: league.teams.length, creditiPerTeam: creditiMedi,
    slots: league.slots });
  const budget = league.teams[league.myTeamIndex].crediti;
  const perRuolo: Record<Ruolo, number> = { P: 0, D: 0, C: 0, A: 0 };
  let tot = 0;
  for (const p of players) {
    const pr = prices.get(p.id)!;
    if (pr > 1) { perRuolo[p.ruolo] += pr; tot += pr; }
  }
  const out = {} as Record<Ruolo, number>;
  let assegnati = 0;
  for (const r of RUOLI) {
    out[r] = Math.max(league.slots[r],
      Math.round(budget * (tot > 0 ? perRuolo[r] / tot : 0.25)));
    assegnati += out[r];
  }
  // aggiusta l'arrotondamento sul reparto con l'allocazione più grande
  const maxR = RUOLI.reduce((a, r) => (out[r] > out[a] ? r : a), "D" as Ruolo);
  out[maxR] += budget - assegnati;
  return out;
}

export function targetWarnings(alloc: Record<Ruolo, number>,
  targets: { playerId: number; prezzo: number }[],
  players: Map<number, Player>): string[] {
  const spesa: Record<Ruolo, number> = { P: 0, D: 0, C: 0, A: 0 };
  for (const t of targets) {
    const p = players.get(t.playerId);
    if (p) spesa[p.ruolo] += t.prezzo;
  }
  return RUOLI.filter(r => spesa[r] > alloc[r])
    .map(r => `Target ${r}: ${spesa[r]} su ${alloc[r]} allocati`);
}
```

- [ ] **Step 4: Run** — PASS · **Step 5: `store/strategy.ts`** (pattern identico a `auctions.ts`: persist AsyncStorage, name `"fanta-strategy"`; azioni come da Interfaces) + estendere `persistence.test.ts` col round-trip (scrivi → rileggi → uguale), riusando le utility del file.
- [ ] **Step 6: `strategia.tsx`** — richiede lega attiva e dataset (altrimenti empty state); riga in alto: BUDGET totale grande + residuo non allocato (giallo se ≠ 0); 4 card reparto (RoleChip, `NumberField` allocazione, sotto in dim "suggerito: N" + bottone "usa suggerito"); sezione TARGET: bottone "Aggiungi target" → picker giocatori (ricerca come Task 6), righe `PlayerRow` con `NumberField` compatto per il prezzo obiettivo e rimozione; avvisi `targetWarnings` in `colors.warn` sotto il titolo sezione.
- [ ] **Step 7: Verifica** — test+typecheck+export · **Step 8: Commit** `git commit -m "feat(app): strategia con riparto suggerito e target"`

---

### Task 9: Asta live — barra, ricerca, offerta, registrazione

**Files:**
- Create: `src/components/AuctionTopBar.tsx`, `src/components/BidSheet.tsx`
- Modify: `src/app/(tabs)/asta.tsx` (riscrittura)
- Test: nessuno nuovo (tutta la logica è in `computeLive`/`auction.ts`/`coach.ts`, già coperti)

**Interfaces:**
- Consumes: `computeLive` → `bidAdvice(playerId): { equoLive, maxConsigliato, mioMax, avversari }`, `teamSummary`, `useAuctions` (`purchase`, `getAuction`, `purchaseCoach`), `AuctionError`, `queryListone`/`normalizeSearch`, UI kit, `Badge`, `RoleChip`.
- Produces: `<AuctionTopBar summary />` (sticky: residui MIEI a sinistra in giallo `variant="display"`, a destra 4 coppie `RoleChip`+`slotLiberi[r]`); `<BidSheet player advice onRegister onClose />` (bottom-sheet Modal).

**Comportamento (spec §6.2.4):**
1. Guardie: senza lega attiva o dataset → empty state con CTA verso la tab giusta.
2. `AuctionTopBar` sempre visibile con `teamSummary` della MIA squadra (ricalcolato a ogni acquisto: dipende da `auction`).
3. Ricerca rapida: `TextInput` autofocus-friendly; risultati = `queryListone` con `sort: "equo"` sui soli NON venduti (`soldIds` = acquisti + rosterIniziale di tutte le squadre); riga → apre `BidSheet`. Un toggle "mostra venduti" fa vedere anche i venduti (opachi, tap → avviso "Già acquistato da <squadra>" ricavando la squadra da `auction.purchases`/`rosterIniziale`).
4. `BidSheet` (il cuore): nome+RoleChip+squadra+Badge fascia in alto; tre numeri: EQUO (number 34), **MAX TUO** (display 56, giallo — il numero più grande dello schermo), MIO TETTO (`mioMax`, dim); lista avversari ordinata per `max` decrescente (nome + max, chi ha max 0 in dim barrato); sezione registrazione: griglia di chip squadre (tutte, la mia evidenziata), `NumberField` prezzo (min 1, max 999, default `equoLive`), bottone `ASSEGNA` size lg.
5. Registrazione: `try { purchase(leagueId, league, playersMap, { playerId, teamId, prezzo }) }` → successo: chiudi sheet, torna alla ricerca svuotata; `catch (e)` se `AuctionError` → `Alert.alert("Non registrabile", e.message, [{ text: "Annulla" }, { text: "Registra comunque", style: "destructive", onPress: () => purchase(..., { force: true }) }])` (il force-flow del 2a).
6. Se `league.useCoaches`: un segmento in cima alla ricerca "GIOCATORI | ALLENATORI"; in modalità allenatori la lista viene da `dataset.allenatori` non ancora acquistati (`state.coaches`), il sheet mostra qta come guida e `maxCoachOfferta` come tetto, registra con `purchaseCoach` (stesso pattern force).

- [ ] **Step 1: `AuctionTopBar`** (comportamento 2)
- [ ] **Step 2: `BidSheet`** (comportamento 4-5; Modal `animationType="slide"`, fondo `surface`, handle bar)
- [ ] **Step 3: `asta.tsx`** (comportamenti 1, 3, 6)
- [ ] **Step 4: Verifica** — typecheck + export + `npm test` verde
- [ ] **Step 5: Commit** — `git commit -m "feat(app): asta live - barra, ricerca, offerta e registrazione"`

---

### Task 10: Asta live — registro acquisti, rose avversarie, correzioni

**Files:**
- Create: `src/components/PurchaseLog.tsx`, `src/components/TeamsBoard.tsx`
- Modify: `src/app/(tabs)/asta.tsx` (aggiunge i due pannelli)
- Test: nessuno nuovo

**Interfaces:**
- Consumes: `useAuctions` (`undo`, `remove`, `edit`, `removeCoach`), `teamSummary`, `coachOf`, UI kit.
- Produces: `<PurchaseLog />` e `<TeamsBoard />` montati in `asta.tsx` dietro un segmento "ASTA | REGISTRO | ROSE".

**Comportamento:**
1. Segmento a 3 stati in testa alla tab Asta: ASTA (Task 9), REGISTRO, ROSE.
2. REGISTRO: lista `auction.purchases` dal più recente (nome giocatore, RoleChip, squadra acquirente, prezzo giallo; per gli allenatori riga analoga da `auction.coaches` con badge "ALL"); bottone UNDO in alto (`undo(leagueId)`, disabilitato se vuoto, conferma `Alert`); su ogni riga "matita" → Modal di modifica (chip squadre + `NumberField` prezzo → `edit(leagueId, league, players, purchaseId, patch)` con lo stesso force-flow del Task 9) e "cestino" → `remove` con conferma (per i coach: `removeCoach`).
3. ROSE: una card per squadra (nome + residui grandi; needCoach → puntino giallo "manca allenatore" se `useCoaches`); dentro, righe per ruolo `RoleChip × slots[r]` riempite coi giocatori presi (nome+prezzo) e slot vuoti come trattini dim; la card della MIA squadra per prima ed evidenziata (bordo giallo).

- [ ] **Step 1: `PurchaseLog`** (comportamento 2) · **Step 2: `TeamsBoard`** (comportamento 3) · **Step 3: montare il segmento in `asta.tsx`**
- [ ] **Step 4: Verifica** — typecheck + export + test verdi
- [ ] **Step 5: Commit** — `git commit -m "feat(app): registro con undo/correzioni e rose avversarie"`

---

### Task 11: Riepilogo — analisi affari e spesa per reparto

**Files:**
- Create: `src/domain/riepilogo.ts`
- Modify: `src/app/(tabs)/riepilogo.tsx` (riscrittura)
- Test: `src/domain/__tests__/riepilogo.test.ts`

**Interfaces:**
- Consumes: `teamSummary`, `computeLive` → `LiveContext`, tipi dominio, store, UI kit, `suggestBudgetSplit`/store strategy per il confronto col piano.
- Produces: `riepilogo.ts`: `interface DealRow { playerId: number; nome: string; ruolo: Ruolo; prezzo: number; equo: number; delta: number }` e `buildRiepilogo(league: League, auction: AuctionState, players: Map<number, Player>, live: LiveContext): { rosa: Record<Ruolo, DealRow[]>; spesaPerRuolo: Record<Ruolo, number>; spesaTotale: number; residui: number; affari: DealRow[]; strapagati: DealRow[] }` — `affari` = 3 delta più negativi (solo <0), `strapagati` = 3 più positivi (solo >0), confronto vs `live.adjustedPrice`.

- [ ] **Step 1: Test**

```ts
import { buildRiepilogo } from "../riepilogo";
import { emptyAuction, registerPurchase } from "../auction";
import { computeLive } from "../live";
import { miniDataset } from "./fixtures";
import type { League } from "../types";

test("rosa per ruolo, spesa e classifica affari/strapagati", () => {
  const players = new Map(miniDataset().players.map(p => [p.id, p]));
  const league: League = {
    id: "L1", nome: "T", slots: { P: 1, D: 2, C: 2, A: 1 },
    teams: [
      { id: "t1", nome: "Io", crediti: 100, rosterIniziale: [] },
      { id: "t2", nome: "A", crediti: 100, rosterIniziale: [] },
    ], myTeamIndex: 0, createdAt: "2026-08-14T00:00:00Z",
  };
  const [d1, d2] = [...players.values()].filter(p => p.ruolo === "D");
  let auction = emptyAuction("L1");
  auction = registerPurchase(auction, league, players,
    { playerId: d1.id, teamId: "t1", prezzo: 1 });
  auction = registerPurchase(auction, league, players,
    { playerId: d2.id, teamId: "t1", prezzo: 60 });
  const live = computeLive([...players.values()], league, auction);
  const out = buildRiepilogo(league, auction, players, live);
  expect(out.rosa.D).toHaveLength(2);
  expect(out.spesaPerRuolo.D).toBe(61);
  expect(out.spesaTotale).toBe(61);
  // il pagato 60 con equo basso deve stare tra gli strapagati
  expect(out.strapagati.some(r => r.playerId === d2.id)).toBe(true);
});
```

- [ ] **Step 2: Run** — FAIL · **Step 3: Implementare**

```ts
import type { AuctionState, League, Player, Ruolo } from "./types";
import { teamSummary } from "./auction";
import type { LiveContext } from "./live";

const RUOLI: Ruolo[] = ["P", "D", "C", "A"];

export interface DealRow {
  playerId: number; nome: string; ruolo: Ruolo;
  prezzo: number; equo: number; delta: number;
}

export function buildRiepilogo(league: League, auction: AuctionState,
  players: Map<number, Player>, live: LiveContext) {
  const my = league.teams[league.myTeamIndex];
  const sum = teamSummary(auction, league, players, my.id);
  const rows: DealRow[] = sum.rosa.map(({ playerId, prezzo }) => {
    const pl = players.get(playerId);
    const equo = live.adjustedPrice(playerId);
    return { playerId, nome: pl?.nome ?? "?", ruolo: pl?.ruolo ?? "A",
      prezzo, equo, delta: prezzo - equo };
  });
  const rosa: Record<Ruolo, DealRow[]> = { P: [], D: [], C: [], A: [] };
  const spesaPerRuolo: Record<Ruolo, number> = { P: 0, D: 0, C: 0, A: 0 };
  for (const r of rows) { rosa[r.ruolo].push(r); spesaPerRuolo[r.ruolo] += r.prezzo; }
  const byDelta = [...rows].sort((a, b) => a.delta - b.delta);
  return {
    rosa, spesaPerRuolo,
    spesaTotale: RUOLI.reduce((a, r) => a + spesaPerRuolo[r], 0),
    residui: sum.residui,
    affari: byDelta.slice(0, 3).filter(r => r.delta < 0),
    strapagati: byDelta.slice(-3).reverse().filter(r => r.delta > 0),
  };
}
```

- [ ] **Step 4: Run** — PASS · **Step 5: `riepilogo.tsx`** — empty state se nessun acquisto; altrimenti: header SPESA TOTALE + RESIDUI (numeri display); 4 sezioni ruolo con le righe della rosa (nome, prezzo vs equo, delta colorato ok/danger) e slot vuoti come trattini; card "AFFARI" (verde) e "STRAPAGATI" (rosso) con le 3 righe; se esiste una strategia per la lega: barra di confronto spesa vs alloc per reparto (testo "D: 95/80" in warn se sfora); riga allenatore se presente (`coachOf`).
- [ ] **Step 6: Verifica** — test+typecheck+export · **Step 7: Commit** `git commit -m "feat(app): riepilogo con affari, strapagati e confronto piano"`

---

### Task 12: Polish broadcast — motion, empty state, copy

**Files:**
- Modify: `src/app/(tabs)/asta.tsx`, `src/components/BidSheet.tsx`, `src/components/AuctionTopBar.tsx`, `src/app/(tabs)/listone.tsx`, `src/ui/T.tsx` (se serve un variant), eventuali empty state condivisi in `src/ui/EmptyState.tsx` (Create)
- Test: nessuno nuovo

**Interfaces:** Consumes: `react-native-reanimated` (già installata, v4). Produces: `<EmptyState icon title cta? onPress? />`.

- [ ] **Step 1: `EmptyState`** — icona Ionicons grande dim, titolo `title`, sottotitolo opzionale, `Button` ghost per la CTA; sostituire tutti gli empty state improvvisati dei task 6-11 con questo componente.
- [ ] **Step 2: Motion mirato (POCO ma buono):**
  - `BidSheet`: i tre numeri entrano con `Animated.View` + `FadeInDown.delay(i * 60)` (stagger); il MAX TUO fa un pulse (scale 1→1.06→1 con `withSequence`) quando cambia il valore.
  - `AuctionTopBar`: quando `residui` cambia, il numero rimonta con `key={residui}` + `FadeInUp.duration(200)` (ticker effect).
  - Liste (`listone`, registro): `entering={FadeInDown.delay(Math.min(index, 10) * 30)}` sulle prime righe.
- [ ] **Step 3: Copy pass** — tutte le stringhe UI in italiano coerente e asciutto ("ASSEGNA", "Registra comunque", "Già acquistato da …", "Crea la tua prima lega", "Dataset aggiornato al …"); nessun testo inglese residuo; verificare le maiuscole broadcast (label uppercase, nomi giocatori come nel dataset).
- [ ] **Step 4: Verifica** — typecheck + export + test verdi; smoke visivo con `npx expo start` se disponibile un device/emulatore
- [ ] **Step 5: Commit** — `git commit -m "polish(app): motion broadcast, empty state e copy italiana"`

---

### Task 13: Verifica finale + APK via EAS

**Files:**
- Create: `app/eas.json`
- Modify: `app/app.json` (solo se EAS lo richiede: `android.package` es. `"com.mauro.fantasta"`)

- [ ] **Step 1: Verifica completa della suite**

```powershell
cd D:\railway\fantacalcio\app
npm test -- --watchAll=false     # tutte verdi
npm run typecheck                # pulito
npx expo export --platform android  # ok
```

- [ ] **Step 2: `eas.json`**

```json
{
  "cli": { "appVersionSource": "remote" },
  "build": {
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    }
  }
}
```

- [ ] **Step 3: ⚠️ PASSO UTENTE — login EAS** — serve l'account Expo dell'utente: `npx eas-cli login` (interattivo). Se l'utente non è disponibile, fermarsi qui e segnalare: i task 1-12 sono completi e verificabili senza APK.

- [ ] **Step 4: Build** — `npx eas-cli build --platform android --profile preview` · attendere il link dell'APK · scaricare e installare sul dispositivo Android dell'utente.

- [ ] **Step 5: Smoke manuale sul dispositivo (checklist spec §8):** creare una lega 8 squadre/500 crediti; vedere il listone coi prezzi; aprire un dettaglio; impostare la strategia; registrare 3 acquisti (di cui 1 col force), un undo, una correzione; verificare la barra budget; controllare il riepilogo; attivare gli allenatori in una seconda lega e comprarne uno; spegnere la rete e verificare che TUTTO il flusso d'asta funzioni offline.

- [ ] **Step 6: Commit finale**

```powershell
git add app/eas.json app/app.json
git commit -m "build(app): profilo EAS preview per APK Android"
```

---

## Self-Review (eseguita in scrittura piano)

1. **Spec coverage** — §6.1 multi-lega/selettore: Task 5; §6.2.1 Lega+riparazione: Task 6 (validazione = nota #1); §6.2.2 Listone/dettaglio/perché: Task 7 (computeLive = nota #4); §6.2.3 Strategia: Task 8; §6.2.4 Asta (barra, ricerca, offerta, 2-3 tap, rose, undo/correzioni, venduto bloccato): Task 9-10; §6.2.5 Riepilogo: Task 11; §6.3 persistenza/aggiornamento/stale/import: Task 4+6; §6.4 design: Task 1+12; allenatori opzionali (richiesta utente): Task 3+6+7+9+10+11; input Home (nota #3): Task 1+6; reason refresh (nota #2): Task 4; sanity vorp>0 (nota #5): Task 2; APK: Task 13.
2. **Placeholder scan** — i placeholder del Task 5 sono deliverable espliciti temporanei riempiti dai task 8/9/11 (non "TBD"); i task UI 6/9/10 descrivono comportamento con componenti e chiamate esatte anziché codice riga-per-riga: ogni chiamata citata esiste nelle Interfaces dei task precedenti.
3. **Type consistency** — `validateRosterIniziale(RosterCheckInput)` (T2→T6); `registerCoach(state, league, players, c, opts)` e `purchaseCoach(leagueId, league, players, c, opts)` (T3→T9); `teamSummary` con `coachSpesa/needCoach` (T3→T9/T10/T11); `lastError/lastChecked/refresh` (T4→T6); `queryListone(players, f, prezzo)` (T7→T9); `suggestBudgetSplit`/`targetWarnings` (T8→T11); `buildRiepilogo(league, auction, players, live)` (T11); `parseIntero`/`NumberField` (T1→T6/T8/T9). Nessun nome divergente rilevato.
