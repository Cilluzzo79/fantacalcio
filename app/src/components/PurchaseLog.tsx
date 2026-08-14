import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuctions } from "../store/auctions";
import { AuctionError } from "../domain/auction";
import type { AuctionState, CoachPurchase, League, Player, Purchase } from "../domain/types";
import { colors, radius, spacing } from "../ui/theme";
import { T } from "../ui/T";
import { Badge } from "../ui/Badge";
import { RoleChip } from "../ui/RoleChip";
import { Button } from "../ui/Button";
import { NumberField } from "../ui/NumberField";

type Entry =
  | { kind: "player"; purchase: Purchase }
  | { kind: "coach"; coach: CoachPurchase };

function entryTs(e: Entry): string {
  return e.kind === "player" ? e.purchase.ts : e.coach.ts;
}

/** Registro dell'asta: acquisti giocatori + allenatori dal più recente,
 * con UNDO dell'ultimo giocatore, correzione (matita, solo giocatori) ed
 * eliminazione (cestino) per riga. UNDO resta legato ai soli `purchases`
 * (undoLast non tocca `coaches`: comportamento di dominio invariato). */
export function PurchaseLog({ league, auction, playersById }: {
  league: League; auction: AuctionState; playersById: Map<number, Player>;
}) {
  const undo = useAuctions(s => s.undo);
  const remove = useAuctions(s => s.remove);
  const removeCoach = useAuctions(s => s.removeCoach);

  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);

  const entries = useMemo<Entry[]>(() => {
    const players: Entry[] = auction.purchases.map(p => ({ kind: "player" as const, purchase: p }));
    const coaches: Entry[] = (auction.coaches ?? []).map(c => ({ kind: "coach" as const, coach: c }));
    return [...players, ...coaches].sort((a, b) => entryTs(b).localeCompare(entryTs(a)));
  }, [auction]);

  const editingPurchase = editingPurchaseId
    ? auction.purchases.find(p => p.id === editingPurchaseId) ?? null
    : null;

  function teamNome(teamId: string): string {
    return league.teams.find(t => t.id === teamId)?.nome ?? "squadra sconosciuta";
  }

  function onUndo() {
    Alert.alert("Annullare l'ultimo acquisto?",
      "Verrà rimosso l'ultimo giocatore registrato in ordine di tempo.", [
        { text: "Annulla", style: "cancel" },
        { text: "Conferma", style: "destructive", onPress: () => undo(league.id) },
      ]);
  }

  function onDeletePurchase(p: Purchase) {
    const player = playersById.get(p.playerId);
    Alert.alert("Eliminare l'acquisto?",
      `${player?.nome ?? "Il giocatore"} verrà rimosso dal registro.`, [
        { text: "Annulla", style: "cancel" },
        { text: "Elimina", style: "destructive", onPress: () => remove(league.id, p.id) },
      ]);
  }

  function onDeleteCoach(c: CoachPurchase) {
    Alert.alert("Eliminare l'allenatore?",
      `${c.nome} verrà rimosso dal registro.`, [
        { text: "Annulla", style: "cancel" },
        { text: "Elimina", style: "destructive", onPress: () => removeCoach(league.id, c.id) },
      ]);
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: spacing(4), paddingTop: spacing(3) }}>
        <Button title="Annulla ultimo" variant="ghost"
          disabled={auction.purchases.length === 0} onPress={onUndo} />
      </View>

      <ScrollView style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing(4), paddingBottom: spacing(8) }}>
        {entries.length === 0 && (
          <T variant="dim" style={{ textAlign: "center", marginTop: spacing(6) }}>
            Nessun acquisto registrato.</T>
        )}
        {entries.map(e => e.kind === "player" ? (
          <PurchaseRow key={`p:${e.purchase.id}`} purchase={e.purchase}
            player={playersById.get(e.purchase.playerId)} teamNome={teamNome(e.purchase.teamId)}
            onEdit={() => setEditingPurchaseId(e.purchase.id)}
            onDelete={() => onDeletePurchase(e.purchase)} />
        ) : (
          <CoachPurchaseRow key={`c:${e.coach.id}`} coach={e.coach}
            teamNome={teamNome(e.coach.teamId)}
            onDelete={() => onDeleteCoach(e.coach)} />
        ))}
      </ScrollView>

      <EditPurchaseModal visible={editingPurchase !== null} purchase={editingPurchase}
        league={league} playersById={playersById}
        onClose={() => setEditingPurchaseId(null)} />
    </View>
  );
}

function PurchaseRow({ purchase, player, teamNome, onEdit, onDelete }: {
  purchase: Purchase; player: Player | undefined; teamNome: string;
  onEdit(): void; onDelete(): void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing(2.5),
      borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: spacing(2.5) }}>
      {player ? <RoleChip ruolo={player.ruolo} /> : null}
      <View style={{ flex: 1 }}>
        <T variant="body" numberOfLines={1}>{player?.nome ?? `id ${purchase.playerId}`}</T>
        <T variant="dim" numberOfLines={1}>{teamNome}</T>
      </View>
      <T variant="number" style={{ color: colors.accent }}>{purchase.prezzo}</T>
      <Pressable onPress={onEdit} hitSlop={8}>
        <Ionicons name="pencil-outline" size={18} color={colors.textDim} />
      </Pressable>
      <Pressable onPress={onDelete} hitSlop={8}>
        <Ionicons name="trash-outline" size={18} color={colors.danger} />
      </Pressable>
    </View>
  );
}

function CoachPurchaseRow({ coach, teamNome, onDelete }: {
  coach: CoachPurchase; teamNome: string; onDelete(): void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing(2.5),
      borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: spacing(2.5) }}>
      <Badge text="ALL" color={colors.textDim} />
      <View style={{ flex: 1 }}>
        <T variant="body" numberOfLines={1}>{coach.nome}</T>
        <T variant="dim" numberOfLines={1}>{teamNome}</T>
      </View>
      <T variant="number" style={{ color: colors.accent }}>{coach.prezzo}</T>
      <Pressable onPress={onDelete} hitSlop={8}>
        <Ionicons name="trash-outline" size={18} color={colors.danger} />
      </Pressable>
    </View>
  );
}

/** Modal di correzione di un acquisto giocatore (nessuna correzione per gli
 * allenatori: solo eliminazione, come da comportamento richiesto). Stesso
 * force-flow del BidSheet: un AuctionError in `edit` apre un Alert con
 * l'opzione "Registra comunque" che ritenta con `{ force: true }`. */
function EditPurchaseModal({ visible, purchase, league, playersById, onClose }: {
  visible: boolean; purchase: Purchase | null; league: League;
  playersById: Map<number, Player>; onClose(): void;
}) {
  const edit = useAuctions(s => s.edit);
  const [teamId, setTeamId] = useState(purchase?.teamId ?? league.teams[0]?.id ?? "");
  const [prezzo, setPrezzo] = useState(purchase?.prezzo ?? 1);

  useEffect(() => {
    // reset solo quando cambia davvero l'acquisto in correzione, non ad ogni
    // ricalcolo a parità di selezione (stesso principio del BidSheet).
    if (!purchase) return;
    setTeamId(purchase.teamId);
    setPrezzo(purchase.prezzo);
  }, [purchase?.id]);

  const player = purchase ? playersById.get(purchase.playerId) : undefined;

  function attempt(force?: boolean) {
    if (!purchase) return;
    try {
      edit(league.id, league, playersById, purchase.id, { teamId, prezzo },
        force ? { force: true } : undefined);
      onClose();
    } catch (e) {
      if (e instanceof AuctionError) {
        Alert.alert("Non registrabile", e.message, [
          { text: "Annulla" },
          { text: "Registra comunque", style: "destructive", onPress: () => attempt(true) },
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
          {purchase && (
            <ScrollView contentContainerStyle={{ padding: spacing(4), paddingBottom: spacing(8) }}
              keyboardShouldPersistTaps="handled">
              <T variant="title" style={{ marginBottom: spacing(1) }}>Correggi acquisto</T>
              {player && (
                <T variant="dim" style={{ marginBottom: spacing(3) }}>
                  {player.nome} · {player.squadra}</T>
              )}

              <T variant="label" style={{ marginBottom: spacing(2) }}>Squadra</T>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing(2),
                marginBottom: spacing(3) }}>
                {league.teams.map(t => (
                  <Pressable key={t.id} onPress={() => setTeamId(t.id)}
                    style={{ borderWidth: 1, borderColor: colors.line,
                      backgroundColor: teamId === t.id ? colors.accent : "transparent",
                      borderRadius: radius.md, paddingHorizontal: spacing(2.5),
                      paddingVertical: spacing(1.5) }}>
                    <T variant="label"
                      style={{ color: teamId === t.id ? colors.accentText : colors.textDim }}>
                      {t.nome}</T>
                  </Pressable>
                ))}
              </View>

              <NumberField label="Prezzo" value={prezzo} onChange={setPrezzo} min={1} max={999} />
              <Button title="Salva" size="lg" onPress={() => attempt()} />
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
