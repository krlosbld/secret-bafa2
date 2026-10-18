// Nouvelle lecture de l'évolution (refonte du suivi pédagogique) — module pur, sans base de données,
// partagé par tous les écrans et exports. Pas encore branché : activé avec EVALUATION_V2.
//
// Pour chaque critère noté un jour donné (nouvelle échelle uniquement), on compare son niveau à la
// dernière observation précédente du MÊME critère (identifiant stable, jamais l'intitulé) :
// supérieur = progression, égal = stable, inférieur = recul, aucune = première observation.
// Bilan du jour : ↗ progression (≥1 progrès, 0 recul) · ↔ contrastée (≥1 progrès et ≥1 recul) ·
// → stable (que des stables) · ↘ recul (≥1 recul, 0 progrès) · — données insuffisantes (rien de
// comparable). Aucune moyenne. Un critère non noté ce jour-là est simplement absent.
// Une journée qui n'a que des notes de l'ancienne échelle est marquée « ancienne méthode ».

export type TrendRating = {
  criterionId: string;
  day: number;
  level: number | null; // null = ancienne échelle (non comparable)
};

export type CriterionChange = "progression" | "stable" | "recul" | "premiere";

export type DayTrendStatus = "progression" | "contrastee" | "stable" | "recul" | "insuffisant" | "ancienne_methode";

export type DayTrend = {
  day: number;
  status: DayTrendStatus;
  compared: number; // critères réellement comparés
  details: { criterionId: string; change: CriterionChange; previousDay: number | null; previousLevel: number | null; level: number }[];
  legacyCount: number; // notes de l'ancienne échelle ce jour-là
};

export function computeDayTrends(ratings: TrendRating[], dayCount: number): DayTrend[] {
  const byCriterion = new Map<string, { day: number; level: number }[]>();
  for (const r of ratings) {
    if (r.level === null) continue;
    if (!byCriterion.has(r.criterionId)) byCriterion.set(r.criterionId, []);
    byCriterion.get(r.criterionId)!.push({ day: r.day, level: r.level });
  }
  for (const list of byCriterion.values()) list.sort((a, b) => a.day - b.day);

  const result: DayTrend[] = [];
  for (let day = 0; day < dayCount; day++) {
    const details: DayTrend["details"] = [];
    for (const [criterionId, list] of byCriterion) {
      const idx = list.findIndex((x) => x.day === day);
      if (idx === -1) continue;
      const current = list[idx];
      const previous = idx > 0 ? list[idx - 1] : null;
      const change: CriterionChange = !previous
        ? "premiere"
        : current.level > previous.level
          ? "progression"
          : current.level < previous.level
            ? "recul"
            : "stable";
      details.push({ criterionId, change, previousDay: previous?.day ?? null, previousLevel: previous?.level ?? null, level: current.level });
    }
    const up = details.filter((d) => d.change === "progression").length;
    const down = details.filter((d) => d.change === "recul").length;
    const same = details.filter((d) => d.change === "stable").length;
    const compared = up + down + same;
    const legacyCount = ratings.filter((r) => r.day === day && r.level === null).length;
    const status: DayTrendStatus =
      up > 0 && down > 0
        ? "contrastee"
        : up > 0
          ? "progression"
          : down > 0
            ? "recul"
            : same > 0
              ? "stable"
              : details.length === 0 && legacyCount > 0
                ? "ancienne_methode"
                : "insuffisant";
    result.push({ day, status, compared, details, legacyCount });
  }
  return result;
}

export const TREND_DISPLAY: Record<DayTrendStatus, { symbol: string; label: string; color: string }> = {
  progression: { symbol: "↗", label: "En progression", color: "#16a34a" },
  stable: { symbol: "→", label: "Stable", color: "#64748b" },
  contrastee: { symbol: "↔", label: "Évolution contrastée", color: "#7c3aed" },
  recul: { symbol: "↘", label: "En recul", color: "#ea580c" },
  insuffisant: { symbol: "—", label: "Données insuffisantes", color: "#cbd5e1" },
  ancienne_methode: { symbol: "—", label: "Ancienne méthode d'évaluation", color: "#cbd5e1" },
};
