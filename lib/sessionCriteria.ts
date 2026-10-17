import { prisma } from "@/lib/prisma";
import { sessionFamily } from "@/lib/posteLibrary";

// Critères d'évaluation quotidiens : propres à chaque session. À la première ouverture d'une
// session, ses critères sont créés une fois pour toutes : copie des modèles pour une session BAFA
// (BAFA 1, BAFA 3), aucun pour une session BAFD. Ensuite, ajouts, renommages et suppressions ne
// concernent que cette session.
const SEEDED_KEY = "criteriaSeeded";

async function ensureSessionCriteria(formationId: string) {
  // Le marqueur (clé unique formation + clé) garantit une seule initialisation, même en parallèle.
  const claimed = await prisma.config
    .create({ data: { formationId, key: SEEDED_KEY, value: "true" } })
    .then(() => true)
    .catch(() => false);
  if (!claimed || (await sessionFamily(formationId)) !== "BAFA") return;
  const templates = await prisma.criterion.findMany({ where: { isTemplate: true }, orderBy: { order: "asc" } });
  if (templates.length === 0) return;
  await prisma.criterion.createMany({ data: templates.map((t) => ({ label: t.label, order: t.order, formationId })) });
}

export async function getSessionCriteria(formationId: string) {
  await ensureSessionCriteria(formationId);
  return prisma.criterion.findMany({ where: { formationId }, orderBy: { order: "asc" } });
}
