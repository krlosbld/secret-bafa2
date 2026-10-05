import { prisma } from "@/lib/prisma";
import { DEFAULT_SESSION_TYPE, daysForType, todayISO } from "@/lib/planningConfig";

// Accueil du stagiaire : le programme du jour, heure par heure, et sa dernière évaluation.
// Le planning complet est dans l'onglet Planning, la fiche dans « Ma formation ».

export type HomeBlock = {
  id: string;
  label: string;
  posteLabel: string;
  color: string;
  startMin: number;
  endMin: number;
  mine: boolean; // stagiaire affecté à ce créneau (il l'anime / en a la charge)
  col: number; // colonne d'affichage quand des créneaux se chevauchent
  cols: number; // nombre de colonnes du groupe de chevauchement
};

export type LastEvaluation = {
  label: string;
  posteLabel: string;
  color: string;
  day: number;
  dateLabel: string | null;
  startMin: number;
  endMin: number;
  note: string;
};

export type TraineeHomeData = {
  sessionName: string;
  // nodate : dates pas encore fixées ; before / during / after : par rapport à aujourd'hui (Paris).
  status: "nodate" | "before" | "during" | "after";
  dayIndex: number; // jour affiché (aujourd'hui pendant la session, J1 avant)
  dayCount: number;
  dateLabel: string | null; // « lundi 26 octobre »
  startLabel: string | null; // date de début, pour « commence le … »
  blocks: HomeBlock[];
  nowMin: number | null; // heure actuelle en minutes, seulement pendant la session
  lastEvaluation: LastEvaluation | null;
};

// Dates de session stockées en « AAAA-MM-JJ » : calcul en UTC pour ne jamais décaler d'un jour.
function dayDate(startISO: string, idx: number): Date {
  const d = new Date(`${startISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + idx);
  return d;
}

function longDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

function parisNowMin(): number {
  const [h, m] = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(new Date())
    .split(":")
    .map(Number);
  return h * 60 + m;
}

// Créneaux qui se chevauchent : répartis en colonnes côte à côte (groupe par groupe).
function layout<T extends { startMin: number; endMin: number }>(items: T[]): (T & { col: number; cols: number })[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const out: (T & { col: number; cols: number })[] = [];
  let cluster: (T & { col: number; cols: number })[] = [];
  let clusterEnd = -1;
  let colEnds: number[] = [];

  const flush = () => {
    const cols = colEnds.length;
    for (const it of cluster) it.cols = cols;
    out.push(...cluster);
    cluster = [];
    colEnds = [];
  };

  for (const it of sorted) {
    if (cluster.length && it.startMin >= clusterEnd) flush();
    let col = colEnds.findIndex((end) => end <= it.startMin);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(it.endMin);
    } else {
      colEnds[col] = it.endMin;
    }
    cluster.push({ ...it, col, cols: 1 });
    clusterEnd = Math.max(clusterEnd, it.endMin);
  }
  if (cluster.length) flush();
  return out;
}

export async function loadTraineeHome(playerId: string, formationId: string): Promise<TraineeHomeData> {
  const [formation, configRows, postes, memberships, assignments, evaluations] = await Promise.all([
    prisma.formation.findUnique({ where: { id: formationId }, select: { name: true } }),
    prisma.config.findMany({ where: { formationId, key: { in: ["planningSessionType", "planningStartDate"] } } }),
    prisma.posteType.findMany({ select: { id: true, label: true, color: true } }),
    prisma.groupMember.findMany({ where: { playerId }, select: { groupId: true } }),
    prisma.blockAssignment.findMany({ where: { playerId }, select: { blockId: true } }),
    prisma.evaluation.findMany({
      where: { playerId, note: { not: "" }, block: { formationId } },
      select: { note: true, block: { select: { day: true, startMin: true, endMin: true, label: true, type: true } } },
    }),
  ]);

  const sessionType = configRows.find((r) => r.key === "planningSessionType")?.value ?? DEFAULT_SESSION_TYPE;
  const startISO = configRows.find((r) => r.key === "planningStartDate")?.value ?? null;
  const dayCount = daysForType(sessionType);
  const posteById = new Map(postes.map((p) => [p.id, p]));

  let status: TraineeHomeData["status"] = "nodate";
  let dayIndex = 0;
  if (startISO) {
    const diff = Math.round((dayDate(todayISO(), 0).getTime() - dayDate(startISO, 0).getTime()) / 86400000);
    if (diff < 0) status = "before";
    else if (diff >= dayCount) status = "after";
    else {
      status = "during";
      dayIndex = diff;
    }
  }

  // Programme du jour : les créneaux de tous, plus ceux des groupes dont le stagiaire fait partie.
  let blocks: HomeBlock[] = [];
  if (status === "during" || status === "before") {
    const groupIds = new Set(memberships.map((m) => m.groupId));
    const mine = new Set(assignments.map((a) => a.blockId));
    const rows = await prisma.planningBlock.findMany({
      where: { formationId, day: dayIndex },
      select: { id: true, label: true, type: true, startMin: true, endMin: true, groupId: true },
    });
    blocks = layout(
      rows
        .filter((b) => !b.groupId || groupIds.has(b.groupId))
        .filter((b) => b.endMin > b.startMin)
        .map((b) => {
          const poste = posteById.get(b.type);
          return {
            id: b.id,
            label: b.label,
            posteLabel: poste?.label ?? "",
            color: poste?.color ?? "#64748b",
            startMin: b.startMin,
            endMin: b.endMin,
            mine: mine.has(b.id),
          };
        })
    );
  }

  // Dernière évaluation : le commentaire le plus récent (dans l'ordre du planning) écrit pour lui.
  const last = evaluations.sort((a, b) => b.block.day - a.block.day || b.block.startMin - a.block.startMin)[0];
  const lastPoste = last ? posteById.get(last.block.type) : undefined;

  return {
    sessionName: formation?.name ?? "",
    status,
    dayIndex,
    dayCount,
    dateLabel: startISO && status !== "after" ? longDate(dayDate(startISO, dayIndex)) : null,
    startLabel: startISO ? longDate(dayDate(startISO, 0)) : null,
    blocks,
    nowMin: status === "during" ? parisNowMin() : null,
    lastEvaluation: last
      ? {
          label: last.block.label,
          posteLabel: lastPoste?.label ?? "",
          color: lastPoste?.color ?? "#64748b",
          day: last.block.day,
          dateLabel: startISO ? longDate(dayDate(startISO, last.block.day)) : null,
          startMin: last.block.startMin,
          endMin: last.block.endMin,
          note: last.note,
        }
      : null,
  };
}
