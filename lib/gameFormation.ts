import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getPlayerSession } from "@/lib/playerAuth";
import { getFormationFromCookie } from "@/lib/formationSession";
import { resolveAdminFormationId } from "@/lib/formation";

type GameFormation = { id: string; name: string; active: boolean; startDate: Date | null };

// Session dont on affiche le jeu (secrets, classement) : celle ouverte par un membre connecté avec son
// compte, ou — pour l'admin — la session ouverte, à défaut la formation active. Personne d'autre.
export async function getGameFormation(): Promise<GameFormation | null> {
  const [cookieFormation, player, admin] = await Promise.all([getFormationFromCookie(), getPlayerSession(), getSession()]);
  if (cookieFormation && (player || admin)) return cookieFormation;
  if (!admin) return null;

  const resolved = await resolveAdminFormationId();
  if (!resolved.ok) return null;
  return prisma.formation.findUnique({ where: { id: resolved.formationId }, select: { id: true, name: true, active: true, startDate: true } });
}
