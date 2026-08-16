import { prisma } from "@/lib/prisma";

// Résout un lot d'ids de formateur/directeur vers leur prénom, en une seule requête — utilisé
// partout où une case texte affiche "écrit par X" à côté du contenu.
export async function resolveAuthorNames(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(ids.filter((id): id is string => !!id))];
  if (uniqueIds.length === 0) return new Map();

  const players = await prisma.player.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, firstName: true },
  });
  return new Map(players.map((p) => [p.id, p.firstName]));
}
