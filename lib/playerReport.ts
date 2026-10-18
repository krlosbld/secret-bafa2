import { prisma } from "@/lib/prisma";
import { getSessionCriteria } from "@/lib/sessionCriteria";
import { blockShownForPlayer } from "@/lib/evaluationScope";
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
  finalOpinion: string;
  finalAppraisal: string;
};

export const OPINION_LABELS: Record<string, string> = {
  EN_ATTENTE: "En attente",
  FAVORABLE: "Favorable",
  DEFAVORABLE: "Défavorable",
};

function minToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}`;
}

export async function buildPlayerReport(playerId: string, formationId: string): Promise<PlayerReport | null> {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player || player.formationId !== formationId) return null;

  const [blocks, configRows, postes, criteria, criterionStates, evaluations, ratings, assignments, remarkRows, groupMemberships] =
    await Promise.all([
      prisma.planningBlock.findMany({ where: { formationId }, orderBy: [{ day: "asc" }, { startMin: "asc" }] }),
      prisma.config.findMany({ where: { formationId, key: { in: ["planningSessionType", "planningStartDate"] } } }),
      prisma.posteType.findMany({ orderBy: { order: "asc" } }),
      getSessionCriteria(formationId),
      prisma.criterionState.findMany({ orderBy: { order: "asc" } }),
      prisma.evaluation.findMany({ where: { playerId } }),
      prisma.criterionRating.findMany({ where: { playerId } }),
      prisma.blockAssignment.findMany({ select: { blockId: true, playerId: true } }),
      prisma.dailyRemark.findMany({ where: { playerId } }),
      prisma.groupMember.findMany({ where: { playerId }, select: { groupId: true } }),
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
  const ratingsByKey = new Map(ratings.map((r) => [`${r.criterionId}:${r.day}`, r]));
  // Même règle que la fiche (lib/evaluationScope) : créneaux du stagiaire, groupe compris, plus
  // ceux déjà évalués.
  const memberGroupIds = new Set(groupMemberships.map((m) => m.groupId));
  const evaluatedBlockIds = new Set(evaluations.filter((e) => e.note.trim()).map((e) => e.blockId));
  const stateLabelById = new Map(criterionStates.map((s) => [s.id, s.label]));
  const remarkByDay = new Map(remarkRows.map((r) => [r.day, r.note]));

  const days: DayReport[] = Array.from({ length: dayCount }, (_, day) => {
    const evaluationsForDay = blocks
      .filter(
        (b) =>
          b.day === day &&
          blockShownForPlayer(b, {
            evaluableTypeIds: evaluableIds,
            playerGroupIds: memberGroupIds,
            assignedPlayerIds: assignedByBlock.get(b.id),
            playerId,
            evaluatedBlockIds,
            dayCount,
          })
      )
      .map((b) => ({
        time: `${minToTime(b.startMin)}–${minToTime(b.endMin)}`,
        label: `${b.label} (${posteById.get(b.type)?.label ?? b.type})`,
        note: notesByBlock.get(b.id) ?? "",
      }));

    // Un critère archivé n'apparaît que les jours où il a été noté.
    const criteriaForDay = criteria
      .filter((c) => !c.archived || ratingsByKey.has(`${c.id}:${day}`))
      .map((c) => {
        const rating = ratingsByKey.get(`${c.id}:${day}`);
        const stateLabel = rating ? rating.levelLabel ?? stateLabelById.get(rating.value) ?? null : null;
        return { label: c.label, stateLabel };
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
    finalOpinion: player.finalOpinion,
    finalAppraisal: player.finalAppraisal,
  };
}
