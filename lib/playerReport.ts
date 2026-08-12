import { prisma } from "@/lib/prisma";
import { DEFAULT_SESSION_TYPE, todayISO, daysForType, dateForDayIndex, formatDayHeader } from "@/lib/planningConfig";

export type DayReport = {
  dayLabel: string;
  evaluations: { time: string; label: string; note: string }[];
  criteria: { label: string; stateLabel: string | null }[];
  remark: string;
};

export type PlayerReport = {
  firstName: string;
  code: string;
  days: DayReport[];
  personalNote: string;
  ems: string;
  retourEms: string;
  complementaryNote: string;
  finalAppraisal: string;
};

function minToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}`;
}

export async function buildPlayerReport(playerId: string, formationId: string): Promise<PlayerReport | null> {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player || player.formationId !== formationId) return null;

  const [blocks, configRows, postes, criteria, criterionStates, evaluations, ratings, assignments, remarkRows] =
    await Promise.all([
      prisma.planningBlock.findMany({ where: { formationId }, orderBy: [{ day: "asc" }, { startMin: "asc" }] }),
      prisma.config.findMany({ where: { formationId, key: { in: ["planningSessionType", "planningStartDate"] } } }),
      prisma.posteType.findMany({ orderBy: { order: "asc" } }),
      prisma.criterion.findMany({ orderBy: { order: "asc" } }),
      prisma.criterionState.findMany({ orderBy: { order: "asc" } }),
      prisma.evaluation.findMany({ where: { playerId } }),
      prisma.criterionRating.findMany({ where: { playerId } }),
      prisma.blockAssignment.findMany({ select: { blockId: true, playerId: true } }),
      prisma.dailyRemark.findMany({ where: { playerId } }),
    ]);

  const sessionType = configRows.find((r) => r.key === "planningSessionType")?.value ?? DEFAULT_SESSION_TYPE;
  const startDate = configRows.find((r) => r.key === "planningStartDate")?.value ?? todayISO();
  const dayCount = daysForType(sessionType);

  const posteById = new Map(postes.map((p) => [p.id, p]));
  const evaluableIds = new Set(postes.filter((p) => p.evaluable).map((p) => p.id));

  const assignedByBlock = new Map<string, Set<string>>();
  for (const a of assignments) {
    if (!assignedByBlock.has(a.blockId)) assignedByBlock.set(a.blockId, new Set());
    assignedByBlock.get(a.blockId)!.add(a.playerId);
  }

  const notesByBlock = new Map(evaluations.map((e) => [e.blockId, e.note]));
  const ratingsByKey = new Map(ratings.map((r) => [`${r.criterionId}:${r.day}`, r.value]));
  const stateLabelById = new Map(criterionStates.map((s) => [s.id, s.label]));
  const remarkByDay = new Map(remarkRows.map((r) => [r.day, r.note]));

  const days: DayReport[] = Array.from({ length: dayCount }, (_, day) => {
    const dayBlocks = blocks.filter((b) => b.day === day && evaluableIds.has(b.type));
    const evaluationsForDay = dayBlocks
      .filter((b) => {
        const assigned = assignedByBlock.get(b.id);
        return !assigned || assigned.has(playerId);
      })
      .map((b) => ({
        time: `${minToTime(b.startMin)}–${minToTime(b.endMin)}`,
        label: `${b.label} (${posteById.get(b.type)?.label ?? b.type})`,
        note: notesByBlock.get(b.id) ?? "",
      }));

    const criteriaForDay = criteria.map((c) => {
      const value = ratingsByKey.get(`${c.id}:${day}`);
      return { label: c.label, stateLabel: value ? stateLabelById.get(value) ?? null : null };
    });

    return {
      dayLabel: formatDayHeader(dateForDayIndex(startDate, day)),
      evaluations: evaluationsForDay,
      criteria: criteriaForDay,
      remark: remarkByDay.get(day) ?? "",
    };
  });

  return {
    firstName: player.firstName,
    code: player.code,
    days,
    personalNote: player.personalNote,
    ems: player.ems,
    retourEms: player.retourEms,
    complementaryNote: player.complementaryNote,
    finalAppraisal: player.finalAppraisal,
  };
}
