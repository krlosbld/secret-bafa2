export const POSTE_CATEGORIES: Record<string, string> = {
  THEORIE: "Théorie",
  ANIMATION: "Temps d'animation",
  PREPARATION: "Temps de préparation",
  AUTRE: "Autre",
};

export const DEFAULT_POSTE_CATEGORY = "AUTRE";

// Catégories supplémentaires, propres à certains types de session (ex. l'Approfondissement
// introduit "Thématique" et "Retours stage pratique", absents d'une Formation générale).
const EXTRA_CATEGORIES_BY_SESSION_TYPE: Record<string, Record<string, string>> = {
  APPRO: {
    THEMATIQUE: "Thématique",
    RETOUR_STAGE: "Retours stage pratique",
  },
};

export function categoriesForSessionType(sessionType: string): Record<string, string> {
  const { AUTRE, ...rest } = POSTE_CATEGORIES;
  return { ...rest, ...(EXTRA_CATEGORIES_BY_SESSION_TYPE[sessionType] ?? {}), AUTRE };
}

export function isValidPosteCategory(key: string): boolean {
  if (key in POSTE_CATEGORIES) return true;
  return Object.values(EXTRA_CATEGORIES_BY_SESSION_TYPE).some((extra) => key in extra);
}

// Regroupement des types de créneau dans le sélecteur du planning (indépendant du décompte
// d'heures) : Thématique et Retours stage pratique se choisissent sous le bouton "Autre",
// mais gardent leur propre ligne dans le calcul des heures par catégorie.
const POSTE_PICKER_GROUP: Record<string, string> = {
  THEMATIQUE: "AUTRE",
  RETOUR_STAGE: "AUTRE",
};

export function pickerGroupOf(category: string): string {
  return POSTE_PICKER_GROUP[category] ?? category;
}

export const SESSION_TYPES: Record<string, { label: string; days: number }> = {
  BAFA: { label: "Formation générale (BAFA)", days: 8 },
  APPRO: { label: "Approfondissement", days: 6 },
};

export const DEFAULT_SESSION_TYPE = "BAFA";

export function daysForType(type: string): number {
  return SESSION_TYPES[type]?.days ?? SESSION_TYPES[DEFAULT_SESSION_TYPE].days;
}

export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

const WEEKDAY_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export function dateForDayIndex(startDateISO: string, idx: number): Date {
  const d = new Date(`${startDateISO}T00:00:00`);
  d.setDate(d.getDate() + idx);
  return d;
}

export function formatDayHeader(d: Date): string {
  const wd = WEEKDAY_SHORT[d.getDay()];
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${wd} ${dd}/${mm}`;
}

export function todayDayIndex(startDateISO: string, dayCount: number): number {
  const start = new Date(`${startDateISO}T00:00:00`);
  const today = new Date(`${todayISO()}T00:00:00`);
  const diffDays = Math.round((today.getTime() - start.getTime()) / 86400000);
  return Math.min(Math.max(diffDays, 0), dayCount - 1);
}
