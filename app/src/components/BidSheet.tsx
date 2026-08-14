import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, View } from "react-native";
import type { BidAdvice } from "../domain/live";
import type { Coach, Player, TeamConfig } from "../domain/types";
import { AuctionError } from "../domain/auction";
import { colors, fonts, radius, spacing } from "../ui/theme";
import { T } from "../ui/T";
import { Badge } from "../ui/Badge";
import { RoleChip } from "../ui/RoleChip";
import { Button } from "../ui/Button";
import { NumberField } from "../ui/NumberField";

export type BidSheetSubject =
  | { kind: "player"; player: Player; advice: BidAdvice }
  | { kind: "coach"; coach: Coach; maxOfferta: number };

function subjectKeyOf(subject: BidSheetSubject | null): string | null {
  if (!subject) return null;
  return subject.kind === "player"
    ? `p:${subject.player.id}`
    : `c:${subject.coach.nome}|${subject.coach.squadra}`;
}

function defaultPrezzo(subject: BidSheetSubject): number {
  const guida = subject.kind === "player" ? subject.advice.equoLive : subject.coach.qta;
  return Math.min(999, Math.max(1, Math.round(guida)));
}

/** Bottom-sheet per la registrazione di un'assegnazione in asta (il cuore
 * dell'app): numeri guida (EQUO/MAX TUO/MIO TETTO per un giocatore, QTA/TETTO
 * per un allenatore), lista avversari (solo giocatori) e griglia squadre per
 * assegnare il prezzo. Il flusso di forzatura è qui: un AuctionError in
 * registrazione apre un Alert con l'opzione "Registra comunque" (force). */
export function BidSheet({ visible, subject, teams, myTeamId, onRegister, onRegistered, onClose }: {
  visible: boolean;
  subject: BidSheetSubject | null;
  teams: TeamConfig[];
  myTeamId: string;
  onRegister(teamId: string, prezzo: number, opts?: { force?: boolean }): void;
  onRegistered(): void;
  onClose(): void;
}) {
  const [teamId, setTeamId] = useState(myTeamId);
  const [prezzo, setPrezzo] = useState(1);
  const key = subjectKeyOf(subject);

  useEffect(() => {
    // reset solo quando cambia davvero il soggetto (nuovo giocatore/allenatore
    // selezionato), non ad ogni ricalcolo di advice a parità di selezione:
    // altrimenti un ricalcolo dovuto a un acquisto altrove svuoterebbe
    // il prezzo che l'utente sta digitando.
    if (!subject) return;
    setTeamId(myTeamId);
    setPrezzo(defaultPrezzo(subject));
  }, [key, myTeamId]);

  function attemptRegister(force?: boolean) {
    if (!subject) return;
    try {
      onRegister(teamId, prezzo, force ? { force: true } : undefined);
      onRegistered();
    } catch (e) {
      if (e instanceof AuctionError) {
        Alert.alert("Non registrabile", e.message, [
          { text: "Annulla" },
          { text: "Registra comunque", style: "destructive", onPress: () => attemptRegister(true) },
        ]);
      } else {
        throw e;
      }
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "#000A" }} onPress={onClose}>
        <Pressable style={{ marginTop: "auto", maxHeight: "88%",
          backgroundColor: colors.surface, borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg, borderWidth: 1, borderColor: colors.line,
          borderBottomWidth: 0, overflow: "hidden" }}>
          <View style={{ alignItems: "center", paddingTop: spacing(2) }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line }} />
          </View>
          {subject && (
            <ScrollView contentContainerStyle={{ padding: spacing(4), paddingBottom: spacing(8) }}
              keyboardShouldPersistTaps="handled">
              <Header subject={subject} />
              <Numbers subject={subject} />
              {subject.kind === "player" && <Avversari advice={subject.advice} />}

              <T variant="label" style={{ marginTop: spacing(4), marginBottom: spacing(2) }}>
                Assegna a</T>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing(2),
                marginBottom: spacing(3) }}>
                {teams.map(t => (
                  <TeamChip key={t.id} team={t} selected={teamId === t.id} isMine={t.id === myTeamId}
                    onPress={() => setTeamId(t.id)} />
                ))}
              </View>

              <NumberField label="Prezzo" value={prezzo} onChange={setPrezzo} min={1} max={999} />
              <Button title="Assegna" size="lg" onPress={() => attemptRegister()} />
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Header({ subject }: { subject: BidSheetSubject }) {
  if (subject.kind === "player") {
    const { player } = subject;
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing(2.5),
        marginBottom: spacing(3) }}>
        <RoleChip ruolo={player.ruolo} size={28} />
        <View style={{ flex: 1 }}>
          <T variant="title">{player.nome}</T>
          <T variant="dim">{player.squadra}</T>
        </View>
        <Badge fascia={player.fascia} />
      </View>
    );
  }
  const { coach } = subject;
  return (
    <View style={{ marginBottom: spacing(3) }}>
      <T variant="title">{coach.nome}</T>
      <T variant="dim">{coach.squadra}</T>
    </View>
  );
}

function Numbers({ subject }: { subject: BidSheetSubject }) {
  if (subject.kind === "player") {
    const { advice } = subject;
    return (
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between",
        marginBottom: spacing(4) }}>
        <NumberStat label="Equo" value={advice.equoLive} fontSize={34} color={colors.text} />
        <NumberStat label="Max tuo" value={advice.maxConsigliato} fontSize={56} color={colors.accent} />
        <NumberStat label="Mio tetto" value={advice.mioMax} fontSize={16} color={colors.textDim} />
      </View>
    );
  }
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between",
      marginBottom: spacing(4) }}>
      <NumberStat label="Qta" value={subject.coach.qta} fontSize={34} color={colors.text} />
      <NumberStat label="Tetto" value={subject.maxOfferta} fontSize={56} color={colors.accent} />
    </View>
  );
}

function NumberStat({ label, value, fontSize, color }: {
  label: string; value: number; fontSize: number; color: string;
}) {
  return (
    <View>
      <T variant="label">{label}</T>
      <T style={{ fontFamily: fonts.display, fontSize, color, fontVariant: ["tabular-nums"] }}>
        {value}</T>
    </View>
  );
}

function Avversari({ advice }: { advice: BidAdvice }) {
  const ordinati = [...advice.avversari].sort((a, b) => b.max - a.max);
  return (
    <View style={{ marginBottom: spacing(2) }}>
      <T variant="label" style={{ marginBottom: spacing(1.5) }}>Avversari</T>
      {ordinati.map(a => (
        <View key={a.teamId} style={{ flexDirection: "row", justifyContent: "space-between",
          paddingVertical: spacing(1) }}>
          <T variant="body" style={{ color: a.max === 0 ? colors.textDim : colors.text,
            textDecorationLine: a.max === 0 ? "line-through" : "none" }}>
            {a.nome}</T>
          <T variant="number" style={{ color: a.max === 0 ? colors.textDim : colors.text }}>
            {a.max}</T>
        </View>
      ))}
    </View>
  );
}

function TeamChip({ team, selected, isMine, onPress }: {
  team: TeamConfig; selected: boolean; isMine: boolean; onPress(): void;
}) {
  return (
    <Pressable onPress={onPress}
      style={{ borderWidth: 1, borderColor: isMine ? colors.accent : colors.line,
        backgroundColor: selected ? colors.accent : (isMine ? colors.surfaceAlt : "transparent"),
        borderRadius: radius.md, paddingHorizontal: spacing(2.5), paddingVertical: spacing(1.5) }}>
      <T variant="label"
        style={{ color: selected ? colors.accentText : isMine ? colors.accent : colors.textDim }}>
        {team.nome}{isMine ? " · TU" : ""}
      </T>
    </Pressable>
  );
}
