import { prisma } from "@/lib/prisma";
import { GAME_RULES } from "@/lib/gameRules";
import type { GameState } from "@/lib/gameAccess";

// Données du bloc directeur (lancer le jeu / changer le maître du jeu) : l'équipe éligible
// (directeurs et formateurs rattachés avec compte), les réglages actuels, et le directeur lui-même
// (maître du jeu proposé par défaut au lancement).
export async function loadDirectorControls(formationId: string, state: GameState, selfPlayerId: string | null) {
  const [staff, configRows] = await Promise.all([
    prisma.formationMember.findMany({
      where: { formationId, role: { in: ["DIRECTEUR", "FORMATEUR"] }, playerId: { not: null } },
      select: { playerId: true, role: true, user: { select: { firstName: true, lastName: true } } },
      orderBy: [{ role: "asc" }, { user: { firstName: "asc" } }],
    }),
    prisma.config.findMany({ where: { formationId, key: { in: ["buzzQuota", ...GAME_RULES.map((r) => r.key)] } } }),
  ]);
  const values = new Map(configRows.map((r) => [r.key, r.value]));
  return {
    launched: state.launched,
    launchedAt: state.launchedAt,
    ended: state.ended,
    gameMaster: state.gameMaster,
    selfPlayerId,
    staff: staff.map((m) => ({
      playerId: m.playerId!,
      name: `${m.user.firstName} ${m.user.lastName}`,
      role: m.role === "DIRECTEUR" ? "Directeur" : "Formateur",
    })),
    defaults: {
      buzzQuota: Number(values.get("buzzQuota") ?? 3),
      rules: Object.fromEntries(GAME_RULES.map((r) => [r.key, values.get(r.key) === "true"])),
    },
  };
}
