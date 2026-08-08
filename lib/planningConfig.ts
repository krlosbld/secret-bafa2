export const SESSION_TYPES: Record<string, { label: string; days: number }> = {
  BAFA: { label: "Formation générale (BAFA)", days: 8 },
  APPRO: { label: "Approfondissement", days: 6 },
};

export const DEFAULT_SESSION_TYPE = "BAFA";

export function daysForType(type: string): number {
  return SESSION_TYPES[type]?.days ?? SESSION_TYPES[DEFAULT_SESSION_TYPE].days;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
