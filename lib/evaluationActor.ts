import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getPlayerSession } from "@/lib/playerAuth";

// Auteur d'une saisie pédagogique, figé au moment de l'écriture (l'intitulé reste lisible même si
// la fiche est supprimée plus tard). Un accès admin sans fiche de session reste « Administration ».
export type EvaluationActor = { authorId: string | null; authorLabel: string };

const ROLE_LABEL: Record<string, string> = { DIRECTEUR: "directeur", FORMATEUR: "formateur" };

export async function getEvaluationActor(formationId: string): Promise<EvaluationActor> {
  const playerSession = await getPlayerSession();
  if (playerSession) {
    const p = await prisma.player.findUnique({
      where: { id: playerSession.playerId },
      select: { id: true, firstName: true, role: true, formationId: true },
    });
    if (p && p.formationId === formationId && ROLE_LABEL[p.role]) {
      return { authorId: p.id, authorLabel: `${p.firstName} (${ROLE_LABEL[p.role]})` };
    }
  }
  if (await getSession()) return { authorId: null, authorLabel: "Administration" };
  return { authorId: null, authorLabel: "Inconnu" };
}
