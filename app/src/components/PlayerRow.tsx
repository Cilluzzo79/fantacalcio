import { Pressable, View } from "react-native";
import type { Player } from "../domain/types";
import { colors, spacing } from "../ui/theme";
import { T } from "../ui/T";
import { Badge } from "../ui/Badge";
import { RoleChip } from "../ui/RoleChip";

/** Altezza fissa della riga: usata anche da getItemLayout nel listone
 * per la virtualizzazione della FlatList su ~600 giocatori. */
export const PLAYER_ROW_HEIGHT = 56;

/** Riga compatta di un giocatore nel listone: ruolo, nome, squadra, fascia
 * e prezzo (grande, in giallo). Se venduto: riga attenuata + tag "VENDUTO". */
export function PlayerRow({ player, prezzo, onPress, venduto }: {
  player: Player; prezzo: number | null; onPress(): void; venduto?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({
      height: PLAYER_ROW_HEIGHT, flexDirection: "row", alignItems: "center",
      gap: spacing(2.5), borderBottomWidth: 1, borderBottomColor: colors.line,
      opacity: venduto ? 0.4 : pressed ? 0.7 : 1,
    })}>
      <RoleChip ruolo={player.ruolo} />
      <View style={{ flex: 1 }}>
        <T variant="body" numberOfLines={1}>{player.nome}</T>
        <T variant="dim" numberOfLines={1}>{player.squadra}</T>
      </View>
      <Badge fascia={player.fascia} />
      {venduto && <Badge text="VENDUTO" color={colors.danger} />}
      <T variant="number" style={{ color: colors.accent, minWidth: 40, textAlign: "right" }}>
        {prezzo === null ? "—" : prezzo}
      </T>
    </Pressable>
  );
}
