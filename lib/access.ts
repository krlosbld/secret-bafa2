import { prisma } from "@/lib/prisma";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { getCurrentUser, type CurrentUser } from "@/lib/userSession";

// Contrôle d'accès aux sessions (formations) pour les comptes BafaPilot, toujours évalué côté
// serveur à partir de la base — jamais à partir d'une valeur de cookie.

// STAGIAIRE : rattachement via le lien d'invitation (QR code) de la session.
export const MEMBER_ROLES = ["DIRECTEUR", "FORMATEUR", "STAGIAIRE"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export function isMemberRole(role: string): role is MemberRole {
  return (MEMBER_ROLES as readonly string[]).includes(role);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type FormationAccess =
  | { ok: true; via: "superadmin" }
  | { ok: true; via: "member"; user: CurrentUser; role: string; playerId: string | null }
  | { ok: false; reason: "not_logged_in" | "email_not_verified" | "not_member" };

// Accès à l'intérieur d'une session : super-admin (accès global), ou compte connecté, email
// confirmé et rattaché à cette formation.
export async function getFormationAccess(formationId: string): Promise<FormationAccess> {
  if (isSuperAdmin(await getSession())) return { ok: true, via: "superadmin" };

  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "not_logged_in" };
  if (!user.emailVerifiedAt) return { ok: false, reason: "email_not_verified" };

  const member = await prisma.formationMember.findUnique({
    where: { formationId_userId: { formationId, userId: user.id } },
    select: { role: true, playerId: true },
  });
  if (!member) return { ok: false, reason: "not_member" };
  return { ok: true, via: "member", user, role: member.role, playerId: member.playerId };
}

// Droit d'administrer une session (rattacher des membres…) : super-admin, ou compte GESTIONNAIRE
// (email confirmé) à qui cette formation a été attribuée via ManagerFormation.
export async function canManageFormation(formationId: string): Promise<boolean> {
  if (isSuperAdmin(await getSession())) return true;

  const user = await getCurrentUser();
  // Une session « en tant que » n'agit jamais au nom d'un gestionnaire.
  if (!user?.emailVerifiedAt || user.impersonatorId || user.platformRole !== "GESTIONNAIRE") return false;

  const grant = await prisma.managerFormation.findUnique({
    where: { userId_formationId: { userId: user.id, formationId } },
    select: { id: true },
  });
  return !!grant;
}
