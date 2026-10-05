import { prisma } from "@/lib/prisma";
import { SESSION_TYPES, DEFAULT_SESSION_TYPE, todayISO } from "@/lib/planningConfig";

// « Mes sessions » : les sessions auxquelles un compte est rattaché, réparties entre en cours / à
// venir et archives, et le choix de la session à ouvrir dans l'onglet Formation.

export type SessionCard = {
  formationId: string;
  name: string;
  typeLabel: string;
  typeKey: string; // BAFA | APPRO | BAFD1 | BAFD3 (couleur d'accent de la carte)
  typeShort: string; // « BAFA 1 »
  category: string; // « Formation générale »
  status: "en-cours" | "a-venir" | "archive";
  location: string | null;
  dates: string;
  role: string;
  archived: boolean;
  sortKey: number;
};

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

// Les dates de formation sont stockées à minuit UTC du jour visé : on les lit donc en UTC.
function parts(d: Date) {
  return { day: d.getUTCDate(), month: MONTHS[d.getUTCMonth()], year: d.getUTCFullYear() };
}

// « 12 au 19 octobre 2026 », « 28 septembre au 3 octobre 2026 », « à partir du 12 octobre 2026 ».
export function formatDateRange(start: Date | null, end: Date | null): string {
  if (!start && !end) return "Dates à venir";
  if (start && !end) {
    const s = parts(start);
    return `À partir du ${s.day} ${s.month} ${s.year}`;
  }
  if (!start && end) {
    const e = parts(end);
    return `Jusqu'au ${e.day} ${e.month} ${e.year}`;
  }
  const s = parts(start!);
  const e = parts(end!);
  if (s.year === e.year && s.month === e.month) return `${s.day} au ${e.day} ${e.month} ${e.year}`;
  if (s.year === e.year) return `${s.day} ${s.month} au ${e.day} ${e.month} ${e.year}`;
  return `${s.day} ${s.month} ${s.year} au ${e.day} ${e.month} ${e.year}`;
}

function todayAsStoredMidnight(): Date {
  return new Date(`${todayISO()}T00:00:00.000Z`);
}

// Une session est archivée une fois sa date de fin passée (jour de Paris) ; sans date de fin, elle
// reste « en cours et à venir » tant qu'elle n'a pas été désactivée après avoir commencé.
function isArchived(f: { endDate: Date | null; startDate: Date | null; active: boolean }): boolean {
  const today = todayAsStoredMidnight();
  if (f.endDate) return f.endDate.getTime() < today.getTime();
  return !f.active && !!f.startDate && f.startDate.getTime() < today.getTime();
}

// En cours = commencée (date de début atteinte) et pas archivée ; sinon à venir.
function statusOf(f: { endDate: Date | null; startDate: Date | null; active: boolean }): SessionCard["status"] {
  if (isArchived(f)) return "archive";
  if (f.active || (f.startDate && f.startDate.getTime() <= todayAsStoredMidnight().getTime())) return "en-cours";
  return "a-venir";
}

async function sessionTypes(formationIds: string[]): Promise<Map<string, string>> {
  const rows = await prisma.config.findMany({
    where: { formationId: { in: formationIds }, key: "planningSessionType" },
    select: { formationId: true, value: true },
  });
  const byId = new Map(rows.map((r) => [r.formationId, r.value]));
  return new Map(formationIds.map((id) => [id, SESSION_TYPES[byId.get(id) ?? ""] ? byId.get(id)! : DEFAULT_SESSION_TYPE]));
}

type FormationRow = { id: string; name: string; location: string | null; startDate: Date | null; endDate: Date | null; active: boolean };

export async function toCards(rows: { formation: FormationRow; role: string }[]): Promise<SessionCard[]> {
  const types = await sessionTypes(rows.map((r) => r.formation.id));
  return rows.map(({ formation: f, role }) => {
    const typeKey = types.get(f.id)!;
    const typeLabel = SESSION_TYPES[typeKey].label; // « BAFA 1 — Formation générale »
    const [typeShort, category = ""] = typeLabel.split(" — ");
    return {
      formationId: f.id,
      name: f.name,
      typeLabel,
      typeKey,
      typeShort,
      category,
      status: statusOf(f),
      location: f.location,
      dates: formatDateRange(f.startDate, f.endDate),
      role,
      archived: isArchived(f),
      sortKey: (f.startDate ?? f.endDate)?.getTime() ?? Number.MAX_SAFE_INTEGER,
    };
  });
}

const FORMATION_SELECT = { id: true, name: true, location: true, startDate: true, endDate: true, active: true } as const;

export async function getMySessionCards(userId: string): Promise<SessionCard[]> {
  const memberships = await prisma.formationMember.findMany({
    where: { userId },
    select: { role: true, formation: { select: FORMATION_SELECT } },
  });
  return toCards(memberships);
}

// Onglet Formation pour un compte qui n'a pas encore de session ouverte : laquelle ouvrir ?
// Priorité à la dernière session ouverte (cookie de formation) si le compte y est toujours
// rattaché, sinon la seule session en cours s'il n'y en a qu'une, sinon choix dans « Mes sessions ».
export async function resolveSessionToOpen(
  userId: string,
  lastFormationId: string | null
): Promise<{ kind: "none" } | { kind: "open"; formationId: string } | { kind: "choose" }> {
  const memberships = await prisma.formationMember.findMany({
    where: { userId },
    select: { formation: { select: FORMATION_SELECT } },
  });
  if (memberships.length === 0) return { kind: "none" };
  if (lastFormationId && memberships.some((m) => m.formation.id === lastFormationId)) return { kind: "open", formationId: lastFormationId };

  const current = memberships.filter((m) => !isArchived(m.formation));
  const candidates = current.length > 0 ? current : memberships;
  return candidates.length === 1 ? { kind: "open", formationId: candidates[0].formation.id } : { kind: "choose" };
}

// Où arrive un compte après connexion. Un compte qui n'est que stagiaire va droit à l'accueil de sa
// session (programme du jour) ; sans session, il arrive sur « Mes sessions », qui propose d'en
// rejoindre une ; l'équipe (directeurs, formateurs) choisit sa session dans « Mes sessions ».
export async function homePathFor(userId: string, lastFormationId: string | null): Promise<string> {
  const roles = await prisma.formationMember.findMany({ where: { userId }, select: { role: true } });
  if (roles.length === 0 || roles.some((r) => r.role !== "STAGIAIRE")) return "/sessions";
  const target = await resolveSessionToOpen(userId, lastFormationId);
  return target.kind === "open" ? openSessionPath(target.formationId) : "/sessions";
}

export function openSessionPath(formationId: string, next = "/bafa"): string {
  return `/sessions/ouvrir/${formationId}?next=${encodeURIComponent(next)}`;
}
