import { prisma } from "@/lib/prisma";
import {
  DEFAULT_SESSION_TYPE,
  todayISO,
  daysForType,
  dateForDayIndex,
  formatDayHeader,
  categoriesForSessionType,
} from "@/lib/planningConfig";

export type ExportBlock = {
  day: number;
  dayLabel: string;
  startMin: number;
  endMin: number;
  label: string;
  posteLabel: string;
};

export type CategoryGroup = { key: string; label: string; minutes: number; blocks: ExportBlock[] };

export function minToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

async function loadPlanningContext(formationId: string) {
  const [blocks, configRows, postes] = await Promise.all([
    prisma.planningBlock.findMany({ where: { formationId }, orderBy: [{ day: "asc" }, { startMin: "asc" }] }),
    prisma.config.findMany({ where: { formationId, key: { in: ["planningSessionType", "planningStartDate"] } } }),
    prisma.posteType.findMany({ orderBy: { order: "asc" } }),
  ]);
  const sessionType = configRows.find((r) => r.key === "planningSessionType")?.value ?? DEFAULT_SESSION_TYPE;
  const startDate = configRows.find((r) => r.key === "planningStartDate")?.value ?? todayISO();
  const dayCount = daysForType(sessionType);
  return { blocks, postes, sessionType, startDate, dayCount };
}

export async function buildCategoryGroups(
  formationId: string,
  selectedKeys: string[] | null
): Promise<{ groups: CategoryGroup[]; totalMinutes: number }> {
  const { blocks, postes, sessionType, startDate, dayCount } = await loadPlanningContext(formationId);
  const categories = categoriesForSessionType(sessionType);
  const posteById = new Map(postes.map((p) => [p.id, p]));
  const keys = selectedKeys && selectedKeys.length > 0 ? selectedKeys.filter((k) => k in categories) : Object.keys(categories);

  const groups: CategoryGroup[] = keys.map((key) => ({ key, label: categories[key], minutes: 0, blocks: [] }));
  const groupByKey = new Map(groups.map((g) => [g.key, g]));

  for (const b of blocks) {
    if (b.day >= dayCount) continue;
    const poste = posteById.get(b.type);
    if (poste && !poste.countedInHours) continue;
    const category = poste?.category ?? "AUTRE";
    const group = groupByKey.get(category);
    if (!group) continue;
    group.minutes += b.endMin - b.startMin;
    group.blocks.push({
      day: b.day,
      dayLabel: formatDayHeader(dateForDayIndex(startDate, b.day)),
      startMin: b.startMin,
      endMin: b.endMin,
      label: b.label,
      posteLabel: poste?.label ?? b.type,
    });
  }
  for (const g of groups) g.blocks.sort((a, b) => a.day - b.day || a.startMin - b.startMin);

  const totalMinutes = groups.reduce((s, g) => s + g.minutes, 0);
  return { groups, totalMinutes };
}

export async function buildDayListing(formationId: string): Promise<{ dayLabel: string; blocks: ExportBlock[] }[]> {
  const { blocks, postes, startDate, dayCount } = await loadPlanningContext(formationId);
  const posteById = new Map(postes.map((p) => [p.id, p]));
  const days: { dayLabel: string; blocks: ExportBlock[] }[] = Array.from({ length: dayCount }, (_, day) => ({
    dayLabel: formatDayHeader(dateForDayIndex(startDate, day)),
    blocks: [],
  }));
  for (const b of blocks) {
    if (b.day >= dayCount) continue;
    const poste = posteById.get(b.type);
    days[b.day].blocks.push({
      day: b.day,
      dayLabel: days[b.day].dayLabel,
      startMin: b.startMin,
      endMin: b.endMin,
      label: b.label,
      posteLabel: poste?.label ?? b.type,
    });
  }
  for (const d of days) d.blocks.sort((a, b) => a.startMin - b.startMin);
  return days;
}
