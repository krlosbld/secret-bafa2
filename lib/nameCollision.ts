import { prisma } from "@/lib/prisma";
import { fuzzyMatch } from "@/lib/fuzzy";

function firstToken(s: string): string {
  return s.trim().split(/\s+/)[0] ?? s;
}

// Deux personnes portant (quasi) le même prénom dans une même formation entretiennent la confusion
// partout où seul le prénom est affiché (buzz, auteur d'une case, responsable d'un créneau...). On
// compare le nom complet, mais aussi juste le premier mot de chaque côté : un compte enregistré comme
// "Cyrielle Bozetto" (nom de famille ajouté pour lever une ambiguïté) doit quand même être détecté si
// quelqu'un tape juste "Cyrielle" ou une variante ("Cyriel") — sinon le nom de famille qui sert à
// distinguer deux personnes finit par rendre les doublons plus faciles à créer, pas moins.
export async function findNameCollision(formationId: string, firstName: string, excludePlayerId?: string): Promise<string | null> {
  const target = firstName.trim();
  if (!target) return null;
  const targetFirstToken = firstToken(target);

  const players = await prisma.player.findMany({
    where: { formationId, ...(excludePlayerId ? { id: { not: excludePlayerId } } : {}) },
    select: { firstName: true },
  });
  const collision = players.find(
    (p) =>
      fuzzyMatch(p.firstName, target, 1) ||
      fuzzyMatch(firstToken(p.firstName), target, 1) ||
      fuzzyMatch(p.firstName, targetFirstToken, 1)
  );
  return collision ? collision.firstName : null;
}

export function nameCollisionError(existingName: string, attemptedName: string): string {
  return `${existingName} existe déjà dans cette formation — ajoute un nom de famille ou une initiale pour les différencier (ex : ${attemptedName} B.).`;
}
