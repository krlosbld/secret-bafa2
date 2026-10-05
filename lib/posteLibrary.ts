import { prisma } from "@/lib/prisma";
import { getVerifiedUser } from "@/lib/userSession";
import { DEFAULT_SESSION_TYPE } from "@/lib/planningConfig";
import type { PosteType } from "@prisma/client";

// Temps de formation (types de créneaux) : chaque compte a sa propre liste par famille de session
// (BAFA pour BAFA 1 / BAFA 3, BAFD pour BAFD 1 / BAFD 3). Ses créations et modifications ne
// changent rien pour les autres comptes. Le planning d'une session reste commun : un créneau posé
// par quelqu'un s'affiche pour tous avec son nom et sa couleur, mais n'entre pas dans leur liste.

export type PosteFamily = "BAFA" | "BAFD";

export function familyOf(sessionType: string): PosteFamily {
  return sessionType === "BAFD1" || sessionType === "BAFD3" ? "BAFD" : "BAFA";
}

export async function sessionFamily(formationId: string): Promise<PosteFamily> {
  const row = await prisma.config.findUnique({ where: { formationId_key: { formationId, key: "planningSessionType" } } });
  return familyOf(row?.value ?? DEFAULT_SESSION_TYPE);
}

// À qui appartient la liste utilisée dans cette session : le compte connecté ; pour le super-admin
// (qui n'a pas de liste à lui), celle du premier directeur rattaché à la session.
export async function libraryOwnerId(formationId: string): Promise<string | null> {
  const user = await getVerifiedUser();
  if (user && !(user.platformRole === "SUPERADMIN" && !user.impersonatorId)) return user.id;
  const director = await prisma.formationMember.findFirst({
    where: { formationId, role: "DIRECTEUR" },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  return director?.userId ?? null;
}

// Première utilisation d'une famille par un compte : la liste BAFA est remplie avec une copie des
// modèles ; la liste BAFD démarre vide. Une seule fois par compte et par famille (même si le compte
// supprime ensuite tous ses temps de formation).
async function ensureSeeded(userId: string, family: PosteFamily) {
  const claimed = await prisma.user.updateMany({
    where: { id: userId, NOT: { seededPosteFamilies: { has: family } } },
    data: { seededPosteFamilies: { push: family } },
  });
  if (claimed.count === 0 || family !== "BAFA") return;
  const templates = await prisma.posteType.findMany({ where: { isTemplate: true, family }, orderBy: { order: "asc" } });
  if (templates.length === 0) return;
  await prisma.posteType.createMany({
    data: templates.map((t) => ({
      label: t.label,
      color: t.color,
      order: t.order,
      evaluable: t.evaluable,
      category: t.category,
      countedInHours: t.countedInHours,
      family,
      ownerUserId: userId,
    })),
  });
}

export async function getLibrary(userId: string, family: PosteFamily): Promise<PosteType[]> {
  await ensureSeeded(userId, family);
  return prisma.posteType.findMany({ where: { ownerUserId: userId, family, isTemplate: false }, orderBy: { order: "asc" } });
}

export type SessionPoste = PosteType & { mine: boolean };

// Temps de formation utiles dans une session : la liste du compte (« mine », proposée dans la
// palette et modifiable) + ceux déjà posés au planning par d'autres (affichage seulement).
export async function getSessionPostes(formationId: string): Promise<{ postes: SessionPoste[]; ownerId: string | null; family: PosteFamily }> {
  const [family, ownerId] = await Promise.all([sessionFamily(formationId), libraryOwnerId(formationId)]);
  const library = ownerId ? await getLibrary(ownerId, family) : [];
  const libraryIds = new Set(library.map((p) => p.id));
  const usedIds = (
    await prisma.planningBlock.findMany({ where: { formationId }, select: { type: true }, distinct: ["type"] })
  )
    .map((b) => b.type)
    .filter((id) => !libraryIds.has(id));
  const used = usedIds.length ? await prisma.posteType.findMany({ where: { id: { in: usedIds } }, orderBy: { order: "asc" } }) : [];
  return {
    postes: [...library.map((p) => ({ ...p, mine: true })), ...used.map((p) => ({ ...p, mine: false }))],
    ownerId,
    family,
  };
}
