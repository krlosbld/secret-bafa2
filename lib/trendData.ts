import { prisma } from "@/lib/prisma";
import { computeDayTrends, type CriterionChange, type DayTrend, type DayTrendStatus } from "@/lib/pedagogicalTrend";
import { getSessionLevels } from "@/lib/ratingLevels";

// Accès aux données pour la nouvelle lecture de l'évolution (refonte, EVALUATION_V2) : charge les
// appréciations d'une session et les confie au module pur lib/pedagogicalTrend. Tous les écrans
// (tableau Stagiaires, fiche, vue stagiaire) passent par ici : une seule règle de calcul.

export type TrendCell = { status: DayTrendStatus; compared: number };

// Statut de chaque jour pour chaque stagiaire (tableau Stagiaires, fiche).
export async function loadDayTrends(formationId: string, dayCount: number, playerIds?: string[]): Promise<Map<string, TrendCell[]>> {
  const ratings = await prisma.criterionRating.findMany({
    where: playerIds ? { playerId: { in: playerIds }, player: { formationId } } : { player: { formationId } },
    select: { playerId: true, criterionId: true, day: true, level: true },
  });
  const byPlayer = new Map<string, typeof ratings>();
  for (const r of ratings) {
    if (r.day >= dayCount) continue;
    if (!byPlayer.has(r.playerId)) byPlayer.set(r.playerId, []);
    byPlayer.get(r.playerId)!.push(r);
  }
  const ids = playerIds ?? [...byPlayer.keys()];
  const result = new Map<string, TrendCell[]>();
  for (const id of ids) {
    result.set(
      id,
      computeDayTrends(byPlayer.get(id) ?? [], dayCount).map((t) => ({ status: t.status, compared: t.compared }))
    );
  }
  return result;
}

export type TrendDetailItem = {
  criterionId: string;
  criterion: string;
  archived: boolean;
  change: CriterionChange;
  level: number;
  levelLabel: string;
  comment: string | null;
  previousDay: number | null;
  previousLevelLabel: string | null;
  author?: string | null; // équipe seulement
};

export type TrendDetail = {
  day: number;
  status: DayTrendStatus;
  compared: number;
  items: TrendDetailItem[];
  // Appréciations de l'ancienne méthode ce jour-là, avec leurs intitulés d'origine (non comparables).
  legacy: { criterion: string; label: string }[];
};

const CHANGE_ORDER: Record<CriterionChange, number> = { recul: 0, progression: 1, stable: 2, premiere: 3 };

// Détail d'un cercle : critère par critère, ce qui a été comparé et avec quoi. Les auteurs ne sont
// joints que pour l'équipe ; l'historique technique n'est jamais renvoyé ici.
export async function loadTrendDetail(params: {
  formationId: string;
  playerId: string;
  day: number;
  dayCount: number;
  forStaff: boolean;
}): Promise<TrendDetail> {
  const { formationId, playerId, day, dayCount, forStaff } = params;
  const [ratings, criteria, levels, states] = await Promise.all([
    prisma.criterionRating.findMany({ where: { playerId, day: { lt: dayCount } } }),
    prisma.criterion.findMany({ where: { formationId }, select: { id: true, label: true, archivedAt: true, order: true } }),
    getSessionLevels(formationId),
    prisma.criterionState.findMany({ select: { id: true, label: true } }),
  ]);
  const criterionById = new Map(criteria.map((c) => [c.id, c]));
  const levelLabel = new Map(levels.map((l) => [l.level, l.label]));
  const stateLabel = new Map(states.map((s) => [s.id, s.label]));
  const ratingAt = new Map(ratings.map((r) => [`${r.criterionId}:${r.day}`, r]));

  const trend: DayTrend = computeDayTrends(ratings, dayCount)[day] ?? { day, status: "insuffisant", compared: 0, details: [], legacyCount: 0 };
  const items: TrendDetailItem[] = trend.details
    .filter((d) => criterionById.has(d.criterionId))
    .map((d) => {
      const c = criterionById.get(d.criterionId)!;
      const rating = ratingAt.get(`${d.criterionId}:${day}`);
      return {
        criterionId: d.criterionId,
        criterion: c.label,
        archived: !!c.archivedAt,
        change: d.change,
        level: d.level,
        levelLabel: levelLabel.get(d.level) ?? String(d.level),
        comment: rating?.comment ?? null,
        previousDay: d.previousDay,
        previousLevelLabel: d.previousLevel === null ? null : levelLabel.get(d.previousLevel) ?? String(d.previousLevel),
        ...(forStaff ? { author: rating?.authorLabel ?? null } : {}),
      };
    })
    .sort((a, b) => CHANGE_ORDER[a.change] - CHANGE_ORDER[b.change] || (criterionById.get(a.criterionId)!.order - criterionById.get(b.criterionId)!.order));

  const legacy = ratings
    .filter((r) => r.day === day && r.level === null && criterionById.has(r.criterionId))
    .sort((a, b) => criterionById.get(a.criterionId)!.order - criterionById.get(b.criterionId)!.order)
    .map((r) => ({ criterion: criterionById.get(r.criterionId)!.label, label: stateLabel.get(r.value) ?? "—" }));

  return { day, status: trend.status, compared: trend.compared, items, legacy };
}
