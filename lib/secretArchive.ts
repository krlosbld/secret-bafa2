import { prisma } from "@/lib/prisma";
import { getVerifiedUser } from "@/lib/userSession";
import { similarity, TOO_CLOSE } from "@/lib/textSimilarity";

// Anciens vrais secrets réutilisables pour fabriquer des faux secrets : ceux validés dans les AUTRES
// sessions auxquelles le compte du maître du jeu est rattaché (toutes pour le super-admin). Seul le
// texte sort d'ici, jamais l'auteur.
async function archiveFormationIds(formationId: string): Promise<string[]> {
  const user = await getVerifiedUser();
  if (!user || (user.platformRole === "SUPERADMIN" && !user.impersonatorId)) {
    return (await prisma.formation.findMany({ where: { id: { not: formationId } }, select: { id: true } })).map((f) => f.id);
  }
  const memberships = await prisma.formationMember.findMany({
    where: { userId: user.id, formationId: { not: formationId } },
    select: { formationId: true },
  });
  return memberships.map((m) => m.formationId);
}

export async function archiveSecretContents(formationId: string): Promise<string[]> {
  const ids = await archiveFormationIds(formationId);
  if (ids.length === 0) return [];
  const rows = await prisma.secret.findMany({
    where: { formationId: { in: ids }, isDecoy: false, status: { in: ["PUBLISHED", "FOUND"] } },
    select: { content: true },
  });
  return rows.map((r) => r.content);
}

// Un faux secret ne doit pas reprendre (presque) mot pour mot un vrai secret, d'aucune session :
// son auteur pourrait être reconnu.
export async function tooCloseToRealSecret(content: string): Promise<boolean> {
  const real = await prisma.secret.findMany({ where: { isDecoy: false }, select: { content: true } });
  return real.some((r) => similarity(r.content, content) >= TOO_CLOSE);
}
