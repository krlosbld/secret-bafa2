import { getSession } from "@/lib/auth";
import { getPlayerSession } from "@/lib/playerAuth";
import { prisma } from "@/lib/prisma";

// formationId: null = super-admin/gestionnaire (n'importe quelle formation)
// formationId: string = DIRECTEUR (restreint à sa propre formation)
export type GameAdminAuth = { ok: true; formationId: string | null } | { ok: false };

export async function getGameAdminAuth(): Promise<GameAdminAuth> {
  const session = await getSession();
  if (session) return { ok: true, formationId: null };

  const playerSession = await getPlayerSession();
  if (!playerSession) return { ok: false };

  const player = await prisma.player.findUnique({
    where: { id: playerSession.playerId },
    select: { role: true, formationId: true },
  });
  if (player?.role === "DIRECTEUR") return { ok: true, formationId: player.formationId };

  return { ok: false };
}
