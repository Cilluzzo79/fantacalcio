import { useMemo } from "react";
import { ScrollView, View } from "react-native";
import { teamSummary } from "../domain/auction";
import { coachOf } from "../domain/coach";
import type { AuctionState, League, Player, Ruolo, TeamConfig } from "../domain/types";
import { colors, fonts, radius, spacing } from "../ui/theme";
import { T } from "../ui/T";
import { Badge } from "../ui/Badge";
import { RoleChip } from "../ui/RoleChip";

const RUOLI: Ruolo[] = ["P", "D", "C", "A"];

/** Rose di tutte le squadre della lega: la MIA squadra sempre per prima ed
 * evidenziata (bordo giallo). Per ogni ruolo mostra `slots[r]` marcatori:
 * i giocatori presi (nome+prezzo, risolti da `summary.rosa` via `playersById`)
 * e i posti ancora vuoti come trattini spenti. */
export function TeamsBoard({ league, auction, playersById }: {
  league: League; auction: AuctionState; playersById: Map<number, Player>;
}) {
  const myTeam = league.teams[league.myTeamIndex];

  const orderedTeams = useMemo(() => {
    if (!myTeam) return league.teams;
    return [myTeam, ...league.teams.filter(t => t.id !== myTeam.id)];
  }, [league.teams, myTeam]);

  return (
    <ScrollView style={{ flex: 1 }}
      contentContainerStyle={{ padding: spacing(4), paddingBottom: spacing(8) }}>
      {orderedTeams.map(team => (
        <TeamCard key={team.id} team={team} isMine={team.id === myTeam?.id}
          league={league} auction={auction} playersById={playersById} />
      ))}
    </ScrollView>
  );
}

function TeamCard({ team, isMine, league, auction, playersById }: {
  team: TeamConfig; isMine: boolean; league: League; auction: AuctionState;
  playersById: Map<number, Player>;
}) {
  const summary = useMemo(() => teamSummary(auction, league, playersById, team.id),
    [auction, league, playersById, team.id]);

  const coach = coachOf(auction, team.id);

  const rosaByRole = useMemo(() => {
    const byRole: Record<Ruolo, { nome: string; prezzo: number }[]> =
      { P: [], D: [], C: [], A: [] };
    for (const r of summary.rosa) {
      const p = playersById.get(r.playerId);
      if (!p) continue;
      byRole[p.ruolo].push({ nome: p.nome, prezzo: r.prezzo });
    }
    return byRole;
  }, [summary.rosa, playersById]);

  return (
    <View style={{ borderWidth: 1, borderColor: isMine ? colors.accent : colors.line,
      backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing(3),
      marginBottom: spacing(3) }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <T variant="title" style={{ color: isMine ? colors.accent : colors.text }}>
          {team.nome}{isMine ? " · TU" : ""}</T>
        <T style={{ fontFamily: fonts.display, fontSize: 28, color: colors.accent,
          fontVariant: ["tabular-nums"] }}>{summary.residui}</T>
      </View>

      {league.useCoaches && summary.needCoach && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing(1.5),
          marginTop: spacing(1) }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} />
          <T variant="dim">manca allenatore</T>
        </View>
      )}

      <View style={{ marginTop: spacing(2), gap: spacing(1) }}>
        {RUOLI.map(r => (
          <RoleSlotsRow key={r} ruolo={r} slots={league.slots[r]} occupied={rosaByRole[r]} />
        ))}
      </View>

      {coach && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing(2),
          marginTop: spacing(1.5), paddingTop: spacing(1.5), borderTopWidth: 1,
          borderTopColor: colors.line }}>
          <Badge text="ALL" color={colors.textDim} />
          <T variant="body" style={{ flex: 1 }} numberOfLines={1}>{coach.nome}</T>
          <T variant="number" style={{ color: colors.accent }}>{coach.prezzo}</T>
        </View>
      )}
    </View>
  );
}

function RoleSlotsRow({ ruolo, slots, occupied }: {
  ruolo: Ruolo; slots: number; occupied: { nome: string; prezzo: number }[];
}) {
  const cells = Array.from({ length: Math.max(slots, occupied.length) },
    (_, i) => occupied[i] ?? null);
  if (cells.length === 0) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing(2) }}>
      <RoleChip ruolo={ruolo} size={20} />
      <View style={{ flex: 1, gap: spacing(0.5) }}>
        {cells.map((c, i) => (
          <View key={i} style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {c ? (
              <>
                <T variant="dim" numberOfLines={1} style={{ flex: 1, color: colors.text }}>
                  {c.nome}</T>
                <T variant="dim" style={{ color: colors.accent }}>{c.prezzo}</T>
              </>
            ) : (
              <T variant="dim">—</T>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
