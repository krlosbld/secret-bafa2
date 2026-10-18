import { prisma } from "@/lib/prisma";
import { sessionFamily } from "@/lib/posteLibrary";

// Critères d'évaluation quotidiens : propres à chaque session. À la première ouverture d'une
// session, ses critères sont créés une fois pour toutes : copie des modèles pour une session BAFA
// (BAFA 1, BAFA 3), aucun pour une session BAFD. Ensuite, ajouts, renommages, archivages et
// suppressions ne concernent que cette session.
// Un critère archivé n'est plus proposé à la saisie ; ses notes restent consultables (fiche, PDF)
// pour les jours où il a été noté. Les critères actifs viennent d'abord, dans l'ordre choisi.
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
  const rows = await prisma.criterion.findMany({ where: { formationId }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] });
  return [...rows.filter((c) => !c.archivedAt), ...rows.filter((c) => c.archivedAt)].map((c) => ({
    id: c.id,
    label: c.label,
    order: c.order,
    archived: !!c.archivedAt,
  }));
}

// Pour l'écran de réglages : combien de notes porte chaque critère (renommage, suppression).
export async function getSessionCriteriaWithUsage(formationId: string) {
  const criteria = await getSessionCriteria(formationId);
  const counts = await prisma.criterionRating.groupBy({
    by: ["criterionId"],
    where: { criterionId: { in: criteria.map((c) => c.id) } },
    _count: { _all: true },
  });
  const byId = new Map(counts.map((c) => [c.criterionId, c._count._all]));
  return criteria.map((c) => ({ ...c, ratingCount: byId.get(c.id) ?? 0 }));
}
