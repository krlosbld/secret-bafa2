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

// Comme getGameAdminAuth(), mais autorise aussi un formateur nommé "maître de jeu" par le directeur
// (Player.isGameMaster) — à utiliser uniquement sur les routes strictement liées aux secrets/buzz/
// règles, jamais sur reset-buzz/award-points/end-game/config qui restent réservées au directeur.
export async function getSecretsAdminAuth(): Promise<GameAdminAuth> {
  const session = await getSession();
  if (session) return { ok: true, formationId: null };

  const playerSession = await getPlayerSession();
  if (!playerSession) return { ok: false };

  const player = await prisma.player.findUnique({
    where: { id: playerSession.playerId },
    select: { role: true, formationId: true, isGameMaster: true },
  });
  if (player && (player.role === "DIRECTEUR" || player.isGameMaster)) {
    return { ok: true, formationId: player.formationId };
  }

  return { ok: false };
}
