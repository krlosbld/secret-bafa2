import { getSession } from "@/lib/auth";
import { getPlayerSession } from "@/lib/playerAuth";
import { prisma } from "@/lib/prisma";
import { resolveAdminFormationId } from "@/lib/formation";

const STAFF_ROLES = ["FORMATEUR", "DIRECTEUR"];

export async function canEditPlanning(): Promise<boolean> {
  const adminSession = await getSession();
  if (adminSession) return true;

  const playerSession = await getPlayerSession();
  if (!playerSession) return false;

  const player = await prisma.player.findUnique({
    where: { id: playerSession.playerId },
    select: { role: true },
  });

  return !!player && STAFF_ROLES.includes(player.role);
}

// Comme canEditPlanning(), mais renvoie aussi la formation exacte à utiliser :
// celle du joueur (formateur/directeur) connecté, ou celle résolue pour un admin/gestionnaire sans session joueur.
// À utiliser à la place de canEditPlanning() + getActiveFormationId() partout où les deux étaient enchaînés,
// pour éviter qu'un directeur/formateur n'écrive par erreur dans une autre formation active.
export async function getPlanningAuth(): Promise<{ ok: true; formationId: string } | { ok: false }> {
  const adminSession = await getSession();
  if (adminSession) {
    const resolved = await resolveAdminFormationId();
    return resolved.ok ? { ok: true, formationId: resolved.formationId } : { ok: false };
  }

  const playerSession = await getPlayerSession();
  if (!playerSession) return { ok: false };

  const player = await prisma.player.findUnique({
    where: { id: playerSession.playerId },
    select: { role: true, formationId: true },
  });
  if (!player || !STAFF_ROLES.includes(player.role)) return { ok: false };

  return { ok: true, formationId: player.formationId };
}
