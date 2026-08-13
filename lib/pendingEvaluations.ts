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
};

// Jour courant (index relatif à startDateISO) et minutes écoulées depuis minuit, en heure de Paris —
// calculés sans jamais mélanger une Date construite en "faux local" (le serveur tourne en UTC) avec
// un vrai Date.now(), pour éviter tout décalage de fuseau (ex. le serveur croyant qu'un créneau finit
// 2h plus tard qu'en réalité en été).
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

// Créneaux déjà terminés avec au moins un stagiaire concerné sans retour saisi, à afficher à ce
// formateur/directeur : soit parce qu'il en est explicitement désigné responsable, soit parce
// qu'aucun responsable n'est désigné (dans ce cas tout le staff est relancé — le premier qui remplit
// un stagiaire le fait disparaître pour tous les autres, puisque cette liste est recalculée à chaque
// ouverture depuis les évaluations réellement enregistrées). Utilisé à la fois par le pop-up de rappel
// (PendingEvaluationsGate) et par la route GET /api/planning/pending-evaluations qu'il interroge.
export async function getPendingEvaluations(playerId: string): Promise<PendingBlock[]> {
  const staff = await prisma.player.findUnique({
    where: { id: playerId },
    select: { formationId: true, role: true },
  });
  if (!staff || (staff.role !== "FORMATEUR" && staff.role !== "DIRECTEUR")) return [];

  const formationId = staff.formationId;

  const [blocks, startDateConfig, evaluableTypes] = await Promise.all([
    prisma.planningBlock.findMany({
      where: { formationId, OR: [{ responsibleStaffId: playerId }, { responsibleStaffId: null }] },
      orderBy: [{ day: "asc" }, { startMin: "asc" }],
      select: { id: true, label: true, day: true, startMin: true, endMin: true, type: true },
    }),
    prisma.config.findUnique({ where: { formationId_key: { formationId, key: "planningStartDate" } } }),
    prisma.posteType.findMany({ where: { evaluable: true }, select: { id: true } }),
  ]);
  if (blocks.length === 0) return [];

  const evaluableTypeIds = new Set(evaluableTypes.map((t) => t.id));
  const startDate = startDateConfig?.value ?? todayISO();
  const { day: currentDay, minutes: currentMinutes } = parisNowDayMinutes(startDate);
  // Uniquement les créneaux évaluables (ex. pas "Repas"), d'aujourd'hui (on ignore l'historique des
  // jours précédents), déjà terminés à l'heure qu'il est, en heure de Paris.
  const pastBlocks = blocks.filter(
    (b) => evaluableTypeIds.has(b.type) && b.day === currentDay && b.endMin <= currentMinutes
  );
  if (pastBlocks.length === 0) return [];

  const blockIds = pastBlocks.map((b) => b.id);
  const [assignments, allStagiaires, evaluations] = await Promise.all([
    prisma.blockAssignment.findMany({ where: { blockId: { in: blockIds } }, select: { blockId: true, playerId: true } }),
    prisma.player.findMany({
      where: { formationId, role: "STAGIAIRE", active: true },
      orderBy: { firstName: "asc" },
      select: { id: true, firstName: true },
    }),
    prisma.evaluation.findMany({ where: { blockId: { in: blockIds } }, select: { blockId: true, playerId: true, note: true } }),
  ]);

  const assignedByBlock = new Map<string, string[]>();
  for (const a of assignments) {
    if (!assignedByBlock.has(a.blockId)) assignedByBlock.set(a.blockId, []);
    assignedByBlock.get(a.blockId)!.push(a.playerId);
  }
  const stagiaireById = new Map(allStagiaires.map((s) => [s.id, s]));
  const noteByBlockPlayer = new Map(evaluations.map((e) => [`${e.blockId}:${e.playerId}`, e.note]));

  const result: PendingBlock[] = [];
  for (const b of pastBlocks) {
    const targetIds = assignedByBlock.get(b.id) ?? allStagiaires.map((s) => s.id);
    // Uniquement ceux dont le retour n'est pas encore rempli — dès qu'une case est saisie (par
    // n'importe qui), la personne disparaît de ce créneau.
    const stagiaires: PendingBlockStagiaire[] = targetIds
      .map((id) => stagiaireById.get(id))
      .filter((s): s is { id: string; firstName: string } => !!s)
      .filter((s) => !(noteByBlockPlayer.get(`${b.id}:${s.id}`) ?? "").trim())
      .map((s) => ({ id: s.id, firstName: s.firstName, note: "" }));

    if (stagiaires.length > 0) {
      result.push({ id: b.id, label: b.label, day: b.day, startMin: b.startMin, endMin: b.endMin, stagiaires });
    }
  }

  return result;
}
