import { prisma } from "@/lib/prisma";
import { todayISO, dateForDayIndex } from "@/lib/planningConfig";

export type PendingBlockStagiaire = { id: string; firstName: string; note: string };
export type PendingBlock = {
  id: string;
  label: string;
  day: number;
  startMin: number;
  endMin: number;
  stagiaires: PendingBlockStagiaire[];
};

// Créneaux dont ce formateur/directeur est responsable, déjà terminés, avec au moins un stagiaire
// concerné sans retour saisi. Utilisé à la fois par le pop-up de rappel (PendingEvaluationsGate) et
// par la route GET /api/planning/pending-evaluations qu'il interroge.
export async function getPendingEvaluations(playerId: string): Promise<PendingBlock[]> {
  const staff = await prisma.player.findUnique({
    where: { id: playerId },
    select: { formationId: true, role: true },
  });
  if (!staff || (staff.role !== "FORMATEUR" && staff.role !== "DIRECTEUR")) return [];

  const formationId = staff.formationId;

  const [blocks, startDateConfig] = await Promise.all([
    prisma.planningBlock.findMany({
      where: { formationId, responsibleStaffId: playerId },
      orderBy: [{ day: "asc" }, { startMin: "asc" }],
      select: { id: true, label: true, day: true, startMin: true, endMin: true },
    }),
    prisma.config.findUnique({ where: { formationId_key: { formationId, key: "planningStartDate" } } }),
  ]);
  if (blocks.length === 0) return [];

  const startDate = startDateConfig?.value ?? todayISO();
  const now = Date.now();
  const pastBlocks = blocks.filter((b) => {
    const end = dateForDayIndex(startDate, b.day);
    end.setMinutes(end.getMinutes() + b.endMin);
    return end.getTime() <= now;
  });
  if (pastBlocks.length === 0) return [];

  const blockIds = pastBlocks.map((b) => b.id);
  const [assignments, allStagiaires, evaluations] = await Promise.all([
    prisma.blockAssignment.findMany({ where: { blockId: { in: blockIds } }, select: { blockId: true, playerId: true } }),
    prisma.player.findMany({
      where: { formationId, role: "STAGIAIRE", active: true },
      orderBy: { firstName: "asc" },
      select: { id: true, firstName: true },
    }),
    prisma.evaluation.findMany({ where: { blockId: { in: blockIds } }, select: { blockId: true, playerId: true, note: true } }),
  ]);

  const assignedByBlock = new Map<string, string[]>();
  for (const a of assignments) {
    if (!assignedByBlock.has(a.blockId)) assignedByBlock.set(a.blockId, []);
    assignedByBlock.get(a.blockId)!.push(a.playerId);
  }
  const stagiaireById = new Map(allStagiaires.map((s) => [s.id, s]));
  const noteByBlockPlayer = new Map(evaluations.map((e) => [`${e.blockId}:${e.playerId}`, e.note]));

  const result: PendingBlock[] = [];
  for (const b of pastBlocks) {
    const targetIds = assignedByBlock.get(b.id) ?? allStagiaires.map((s) => s.id);
    const stagiaires: PendingBlockStagiaire[] = targetIds
      .map((id) => stagiaireById.get(id))
      .filter((s): s is { id: string; firstName: string } => !!s)
      .map((s) => ({ id: s.id, firstName: s.firstName, note: noteByBlockPlayer.get(`${b.id}:${s.id}`) ?? "" }));

    const hasMissing = stagiaires.some((s) => !s.note.trim());
    if (hasMissing && stagiaires.length > 0) {
      result.push({ id: b.id, label: b.label, day: b.day, startMin: b.startMin, endMin: b.endMin, stagiaires });
    }
  }

  return result;
}
