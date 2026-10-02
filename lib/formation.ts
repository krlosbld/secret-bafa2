import { prisma } from "@/lib/prisma";
import { getFormationFromCookie } from "@/lib/formationSession";
import { getPlayerSession } from "@/lib/playerAuth";

export type AdminFormationResolution =
  | { ok: true; formationId: string }
  | { ok: false; reason: "none" | "ambiguous" };

// Résout la formation visée par un admin/gestionnaire sans session joueur :
// priorité à la session choisie (cookie signé : sélecteur, « Gérer le jeu de cette session »), même
// inactive — c'est elle que montrent les pages —, sinon la formation active si elle est unique, sinon ambigu.
export async function resolveAdminFormationId(): Promise<AdminFormationResolution> {
  const cookieFormation = await getFormationFromCookie();
  if (cookieFormation) return { ok: true, formationId: cookieFormation.id };

  const actives = await prisma.formation.findMany({ where: { active: true }, select: { id: true } });
  if (actives.length === 1) return { ok: true, formationId: actives[0].id };
  if (actives.length === 0) return { ok: false, reason: "none" };
  return { ok: false, reason: "ambiguous" };
}

// Comme resolveAdminFormationId(), mais priorise d'abord la session joueur (stagiaire/formateur/directeur)
// si elle existe : sa propre formation, active ou non. À utiliser pour les lectures publiques (sans
// exigence de rôle staff) qui doivent rester cohérentes avec ce que voit le joueur connecté, même sur
// une formation inactive.
export async function resolveViewFormationId(): Promise<AdminFormationResolution> {
  const playerSession = await getPlayerSession();
  if (playerSession) {
    const player = await prisma.player.findUnique({
      where: { id: playerSession.playerId },
      select: { formationId: true },
    });
    if (player) return { ok: true, formationId: player.formationId };
  }
  return resolveAdminFormationId();
}
