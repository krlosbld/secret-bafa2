import { prisma } from "@/lib/prisma";
import { fuzzyMatch, normalize } from "@/lib/fuzzy";

function firstToken(s: string): string {
  return s.trim().split(/\s+/)[0] ?? s;
}

// Un prénom raccourci en diminutif ("Cyriel" pour "Cyrielle") diffère de plus d'un caractère de
// l'original — hors de portée de fuzzyMatch(..., 1) — mais reste un vrai préfixe. On l'exige d'au
// moins 3 caractères pour ne pas faire matcher n'importe quel prénom sur une lettre de trop.
function isShortenedPrefix(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na];
  return shorter.length >= 3 && longer.startsWith(shorter);
}

function matchesName(existing: string, target: string): boolean {
  const existingFirstToken = firstToken(existing);
  return (
    fuzzyMatch(existing, target, 1) ||
    fuzzyMatch(existingFirstToken, target, 1) ||
    fuzzyMatch(existing, firstToken(target), 1) ||
    isShortenedPrefix(existingFirstToken, target)
  );
}

// Deux personnes portant (quasi) le même prénom dans une même formation entretiennent la confusion
// partout où seul le prénom est affiché (buzz, auteur d'une case, responsable d'un créneau...). On
// compare le nom complet, mais aussi juste le premier mot de chaque côté et les diminutifs : un compte
// enregistré comme "Cyrielle Bozetto" (nom de famille ajouté pour lever une ambiguïté) doit quand même
// être détecté si quelqu'un tape juste "Cyrielle" ou "Cyriel" — sinon le nom de famille qui sert à
// distinguer deux personnes finit par rendre les doublons plus faciles à créer, pas moins.
export async function findMatchingPlayer(
  formationId: string,
  firstName: string,
  excludePlayerId?: string
): Promise<{ id: string; firstName: string } | null> {
  const target = firstName.trim();
  if (!target) return null;

  const players = await prisma.player.findMany({
    where: { formationId, ...(excludePlayerId ? { id: { not: excludePlayerId } } : {}) },
    select: { id: true, firstName: true },
  });
  return players.find((p) => matchesName(p.firstName, target)) ?? null;
}

export async function findNameCollision(formationId: string, firstName: string, excludePlayerId?: string): Promise<string | null> {
  const match = await findMatchingPlayer(formationId, firstName, excludePlayerId);
  return match?.firstName ?? null;
}

export function nameCollisionError(existingName: string, attemptedName: string): string {
  return `${existingName} existe déjà dans cette formation — ajoute un nom de famille ou une initiale pour les différencier (ex : ${attemptedName} B.).`;
}
