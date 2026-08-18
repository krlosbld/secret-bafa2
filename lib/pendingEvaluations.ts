import { prisma } from "@/lib/prisma";
import { todayISO } from "@/lib/planningConfig";

export type PendingBlockStagiaire = { id: string; firstName: string; note: string };
export type PendingBlock = {
  id: string;
  label: string;
  day: number;
  startMin: number;
  endMin: number;
  stagiaires: PendingBlockStagiaire[];
  groupName: string | null;
  priority: boolean;
};

function parisNowDayMinutes(startDateISO: string): { day: number; minutes: number } {
  const todayParis = todayISO();
  const day = Math.round(
    (new Date(`${todayParis}T00:00:00`).getTime() - new Date(`${startDateISO}T00:00:00`).getTime()) / 86400000
  );
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { day, minutes: hour * 60 + minute };
}

export async function getPendingEvaluations(playerId: string): Promise<PendingBlock[]> {
  const staff = await prisma.player.findUnique({
    where: { id: playerId },
    select: { formationId: true, role: true },
  });
  if (!staff || (staff.role !== "FORMATEUR" && staff.role !== "DIRECTEUR")) return [];

  const formationId = staff.formationId;

  // Groupes où ce formateur/directeur est rattaché — les créneaux liés à l'un de ces groupes
  // remontent en priorité, même sans être "responsable" direct du créneau.
  const groupStaffRows = await prisma.groupStaff.findMany({ where: { playerId }, select: { groupId: true } });
  const staffGroupIds = groupStaffRows.map((g) => g.groupId);

  const [blocks, startDateConfig, evaluableTypes] = await Promise.all([
    prisma.planningBlock.findMany({
      where: {
        formationId,
        OR: [
          { responsibleStaffId: playerId },
          { responsibleStaffId: null, groupId: null },
          { groupId: { in: staffGroupIds } },
        ],
      },
      orderBy: [{ day: "asc" }, { startMin: "asc" }],
      select: { id: true, label: true, day: true, startMin: true, endMin: true, type: true, groupId: true },
    }),
    prisma.config.findUnique({ where: { formationId_key: { formationId, key: "planningStartDate" } } }),
    prisma.posteType.findMany({ where: { evaluable: true }, select: { id: true } }),
  ]);
  if (blocks.length === 0) return [];

  const evaluableTypeIds = new Set(evaluableTypes.map((t) => t.id));
  const startDate = startDateConfig?.value ?? todayISO();
  const { day: currentDay, minutes: currentMinutes } = parisNowDayMinutes(startDate);
  const pastBlocks = blocks.filter(
    (b) => evaluableTypeIds.has(b.type) && b.day === currentDay && b.endMin <= currentMinutes
  );
  if (pastBlocks.length === 0) return [];

  const blockIds = pastBlocks.map((b) => b.id);
  const groupIds = [...new Set(pastBlocks.map((b) => b.groupId).filter((id): id is string => !!id))];

  const [assignments, allStagiaires, evaluations, groupMembers, groupRows] = await Promise.all([
    prisma.blockAssignment.findMany({ where: { blockId: { in: blockIds } }, select: { blockId: true, playerId: true } }),
    prisma.player.findMany({
      where: { formationId, role: "STAGIAIRE", active: true },
      orderBy: { firstName: "asc" },
      select: { id: true, firstName: true },
    }),
    prisma.evaluation.findMany({ where: { blockId: { in: blockIds } }, select: { blockId: true, playerId: true, note: true } }),
    groupIds.length > 0
      ? prisma.groupMember.findMany({ where: { groupId: { in: groupIds } }, select: { groupId: true, playerId: true } })
      : Promise.resolve([]),
    groupIds.length > 0 ? prisma.group.findMany({ where: { id: { in: groupIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);

  const assignedByBlock = new Map<string, string[]>();
  for (const a of assignments) {
    if (!assignedByBlock.has(a.blockId)) assignedByBlock.set(a.blockId, []);
    assignedByBlock.get(a.blockId)!.push(a.playerId);
  }
  const membersByGroup = new Map<string, string[]>();
  for (const m of groupMembers) {
    if (!membersByGroup.has(m.groupId)) membersByGroup.set(m.groupId, []);
    membersByGroup.get(m.groupId)!.push(m.playerId);
  }
  const groupNameById = new Map(groupRows.map((g) => [g.id, g.name]));
  const stagiaireById = new Map(allStagiaires.map((s) => [s.id, s]));
  const noteByBlockPlayer = new Map(evaluations.map((e) => [`${e.blockId}:${e.playerId}`, e.note]));

  const result: PendingBlock[] = [];
  for (const b of pastBlocks) {
    const targetIds = b.groupId
      ? membersByGroup.get(b.groupId) ?? []
      : assignedByBlock.get(b.id) ?? allStagiaires.map((s) => s.id);
    const stagiaires: PendingBlockStagiaire[] = targetIds
      .map((id) => stagiaireById.get(id))
      .filter((s): s is { id: string; firstName: string } => !!s)
      .filter((s) => !(noteByBlockPlayer.get(`${b.id}:${s.id}`) ?? "").trim())
      .map((s) => ({ id: s.id, firstName: s.firstName, note: "" }));

    if (stagiaires.length > 0) {
      result.push({
        id: b.id,
        label: b.label,
        day: b.day,
        startMin: b.startMin,
        endMin: b.endMin,
        stagiaires,
        groupName: b.groupId ? groupNameById.get(b.groupId) ?? null : null,
        priority: !!b.groupId && staffGroupIds.includes(b.groupId),
      });
    }
  }

  // Les créneaux liés à un groupe de ce formateur remontent en premier.
  result.sort((a, b) => (a.priority === b.priority ? 0 : a.priority ? -1 : 1));

  return result;
}
