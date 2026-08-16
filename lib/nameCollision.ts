import { prisma } from "@/lib/prisma";
import { fuzzyMatch } from "@/lib/fuzzy";

// Deux personnes portant (quasi) le même prénom dans une même formation entretiennent la confusion
// partout où seul le prénom est affiché (buzz, auteur d'une case, responsable d'un créneau...). Même
// seuil strict (distance 1) que la vérification déjà en place sur la soumission de secret en libre-
// service, pour rester cohérent dans toute l'appli.
export async function findNameCollision(formationId: string, firstName: string, excludePlayerId?: string): Promise<string | null> {
  const target = firstName.trim();
  if (!target) return null;

  const players = await prisma.player.findMany({
    where: { formationId, ...(excludePlayerId ? { id: { not: excludePlayerId } } : {}) },
    select: { firstName: true },
  });
  const collision = players.find((p) => fuzzyMatch(p.firstName, target, 1));
  return collision ? collision.firstName : null;
}

export function nameCollisionError(existingName: string, attemptedName: string): string {
  return `${existingName} existe déjà dans cette formation — ajoute un nom de famille ou une initiale pour les différencier (ex : ${attemptedName} B.).`;
}
