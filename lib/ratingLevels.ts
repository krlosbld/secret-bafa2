import { prisma } from "@/lib/prisma";

// Appréciations de la nouvelle échelle, propres à chaque session. Les niveaux techniques sont fixes
// (jamais montrés comme des notes, seulement comparés entre eux) ; le directeur ne personnalise que
// l'intitulé, pour sa session. La justification est obligatoire au niveau 1, quel que soit l'intitulé.
export const DEFAULT_RATING_LEVELS = [
  { level: 3, label: "Point d'appui" },
  { level: 2, label: "Satisfaisant" },
  { level: 1, label: "À consolider" },
] as const;

export const JUSTIFICATION_LEVEL = 1;

export async function ensureSessionLevels(formationId: string): Promise<void> {
  const existing = await prisma.ratingLevel.findMany({ where: { formationId }, select: { level: true } });
  const missing = DEFAULT_RATING_LEVELS.filter((d) => !existing.some((e) => e.level === d.level));
  if (missing.length === 0) return;
  await prisma.ratingLevel.createMany({
    data: missing.map((d) => ({ formationId, level: d.level, label: d.label })),
    skipDuplicates: true, // création simultanée : la contrainte (session, niveau) tranche
  });
}

export async function getSessionLevels(formationId: string) {
  await ensureSessionLevels(formationId);
  return prisma.ratingLevel.findMany({ where: { formationId }, orderBy: { level: "desc" } });
}
