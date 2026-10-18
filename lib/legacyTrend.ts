// Ancienne lecture des cercles (moyenne des états du jour), utilisée tant que la refonte n'est pas
// activée. Formule unique, partagée par le tableau Stagiaires et la fiche (auparavant copiée deux fois).
export const LEGACY_SCORE_MIN = -1;
export const LEGACY_SCORE_MAX = 2;

function lerpColor(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}

export function legacyScoreColor(score: number): string {
  if (score <= 0) {
    const t = Math.min(1, Math.max(0, (score - LEGACY_SCORE_MIN) / (0 - LEGACY_SCORE_MIN)));
    return lerpColor("#dc2626", "#f59e0b", t);
  }
  const t = Math.min(1, Math.max(0, score / LEGACY_SCORE_MAX));
  return lerpColor("#f59e0b", "#16a34a", t);
}

export function legacyScoreAngle(score: number): number {
  const t = Math.min(1, Math.max(0, (score - LEGACY_SCORE_MIN) / (LEGACY_SCORE_MAX - LEGACY_SCORE_MIN)));
  return 180 - t * 180;
}

// Moyenne des valeurs des états d'une journée (états sans valeur ignorés) ; null = aucune donnée.
export function legacyDailyLevel(scores: (number | null | undefined)[]): number | null {
  const valid = scores.filter((s): s is number => s !== null && s !== undefined);
  if (valid.length === 0) return null;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}
