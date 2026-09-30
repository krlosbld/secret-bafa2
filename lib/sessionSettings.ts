import { prisma } from "@/lib/prisma";
import { getSuperAdminActor } from "@/lib/adminActor";
import { canManageFormation, getFormationAccess } from "@/lib/access";
import { getPlayerSession } from "@/lib/playerAuth";
import { SESSION_TYPES, DEFAULT_SESSION_TYPE, daysForType } from "@/lib/planningConfig";

// Réglages d'une session (nom, type, dates, lieu) — une seule source de vérité, modifiable par
// l'admin, le gestionnaire de la session et ses directeurs. Le planning en dépend : son type
// (nombre de jours) et sa date de début sont gardés synchronisés avec ceux de la session.

export type SessionSettings = {
  name: string;
  sessionType: string;
  startDate: string | null; // AAAA-MM-JJ
  endDate: string | null; // calculée à partir du type
  location: string;
};

const isoDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

// Fin de session = début + (nombre de jours du type − 1) : 8 jours en BAFA, 6 en Approfondissement.
export function computeEndDate(startISO: string, sessionType: string): string {
  const d = new Date(`${startISO}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + daysForType(sessionType) - 1);
  return d.toISOString().slice(0, 10);
}

export async function getSessionSettings(formationId: string): Promise<SessionSettings | null> {
  const [formation, configs] = await Promise.all([
    prisma.formation.findUnique({ where: { id: formationId }, select: { name: true, location: true, startDate: true, endDate: true } }),
    prisma.config.findMany({ where: { formationId, key: { in: ["planningSessionType", "planningStartDate"] } } }),
  ]);
  if (!formation) return null;
  const sessionType = configs.find((c) => c.key === "planningSessionType")?.value ?? DEFAULT_SESSION_TYPE;
  const startDate = isoDay(formation.startDate) ?? configs.find((c) => c.key === "planningStartDate")?.value ?? null;
  return {
    name: formation.name,
    sessionType,
    startDate,
    endDate: isoDay(formation.endDate) ?? (startDate ? computeEndDate(startDate, sessionType) : null),
    location: formation.location ?? "",
  };
}

export class SettingsError extends Error {}

export async function updateSessionSettings(
  formationId: string,
  input: { name?: unknown; sessionType?: unknown; startDate?: unknown; location?: unknown }
): Promise<SessionSettings> {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const sessionType = typeof input.sessionType === "string" ? input.sessionType : "";
  const startDate = typeof input.startDate === "string" && input.startDate ? input.startDate : null;
  const location = typeof input.location === "string" ? input.location.trim().slice(0, 120) : "";

  if (!name || name.length > 120) throw new SettingsError("Le nom de la session est obligatoire (120 caractères maximum).");
  if (!(sessionType in SESSION_TYPES)) throw new SettingsError("Type de formation invalide.");
  if (startDate && (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || Number.isNaN(Date.parse(`${startDate}T00:00:00Z`)))) {
    throw new SettingsError("Date de début invalide.");
  }

  const endDate = startDate ? computeEndDate(startDate, sessionType) : null;
  const upsert = (key: string, value: string) =>
    prisma.config.upsert({ where: { formationId_key: { formationId, key } }, update: { value }, create: { formationId, key, value } });

  await prisma.$transaction([
    prisma.formation.update({
      where: { id: formationId },
      data: {
        name,
        location: location || null,
        startDate: startDate ? new Date(`${startDate}T00:00:00.000Z`) : null,
        endDate: endDate ? new Date(`${endDate}T00:00:00.000Z`) : null,
      },
    }),
    upsert("planningSessionType", sessionType),
    ...(startDate ? [upsert("planningStartDate", startDate)] : []),
  ]);
  return { name, sessionType, startDate, endDate, location };
}

// Qui peut modifier les réglages d'une session : super-admin, gestionnaire qui la gère, ou un
// directeur de cette session (compte BafaPilot rattaché en Directeur, ou fiche directeur connectée).
export async function canEditSessionSettings(formationId: string): Promise<boolean> {
  if (await getSuperAdminActor()) return true;
  if (await canManageFormation(formationId)) return true;

  const access = await getFormationAccess(formationId);
  if (access.ok && access.via === "member" && access.role === "DIRECTEUR") return true;

  const playerSession = await getPlayerSession();
  if (playerSession) {
    const player = await prisma.player.findUnique({ where: { id: playerSession.playerId }, select: { formationId: true, role: true } });
    if (player?.formationId === formationId && player.role === "DIRECTEUR") return true;
  }
  return false;
}

// Le type et la date de début changés depuis l'onglet Planning mettent aussi à jour les dates de la session.
export async function syncSessionDatesFromPlanning(formationId: string, sessionType: string, startDate: string) {
  await prisma.formation.update({
    where: { id: formationId },
    data: {
      startDate: new Date(`${startDate}T00:00:00.000Z`),
      endDate: new Date(`${computeEndDate(startDate, sessionType)}T00:00:00.000Z`),
    },
  });
}
