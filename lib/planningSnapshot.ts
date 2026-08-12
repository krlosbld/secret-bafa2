import { prisma } from "@/lib/prisma";

const MAX_SNAPSHOTS_PER_FORMATION = 100;

// Prend une photo de tous les créneaux actuels d'une formation avant une création/modification/
// suppression, pour pouvoir revenir en arrière en cas de perte. Purge les plus anciennes au-delà
// de MAX_SNAPSHOTS_PER_FORMATION pour éviter une croissance illimitée.
export async function snapshotPlanning(formationId: string): Promise<void> {
  const blocks = await prisma.planningBlock.findMany({
    where: { formationId },
    select: { id: true, day: true, startMin: true, endMin: true, label: true, type: true },
  });

  await prisma.planningSnapshot.create({
    data: { formationId, blocks: JSON.stringify(blocks) },
  });

  const old = await prisma.planningSnapshot.findMany({
    where: { formationId },
    orderBy: { createdAt: "desc" },
    skip: MAX_SNAPSHOTS_PER_FORMATION,
    select: { id: true },
  });
  if (old.length > 0) {
    await prisma.planningSnapshot.deleteMany({ where: { id: { in: old.map((s) => s.id) } } });
  }
}
