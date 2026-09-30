import { prisma } from "@/lib/prisma";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { getVerifiedUser } from "@/lib/userSession";

// Identité de la personne qui agit dans l'administration, pour les contrôles de droits et le journal.

export const LEGACY_SUPERADMIN = "LEGACY_SUPERADMIN";

export type AdminActor = {
  kind: "superadmin" | "gestionnaire";
  userId: string | null; // null = super-admin du .env
  label: string;
};

// Super-admin : compte BafaPilot SUPERADMIN, ou super-admin historique du .env.
export async function getSuperAdminActor(): Promise<AdminActor | null> {
  const user = await getVerifiedUser();
  if (user && !user.impersonatorId && user.platformRole === "SUPERADMIN") {
    return { kind: "superadmin", userId: user.id, label: `${user.firstName} ${user.lastName} <${user.email}>` };
  }
  if (isSuperAdmin(await getSession())) return { kind: "superadmin", userId: null, label: "Super-admin (.env)" };
  return null;
}

// Super-admin, ou gestionnaire (compte GESTIONNAIRE) — à combiner avec canManageFormation() pour
// vérifier qu'une formation précise lui a bien été attribuée.
export async function getManagerActor(): Promise<AdminActor | null> {
  const superAdmin = await getSuperAdminActor();
  if (superAdmin) return superAdmin;
  const user = await getVerifiedUser();
  if (user && !user.impersonatorId && user.platformRole === "GESTIONNAIRE") {
    return { kind: "gestionnaire", userId: user.id, label: `${user.firstName} ${user.lastName} <${user.email}>` };
  }
  return null;
}

export async function audit(
  actor: AdminActor,
  action: string,
  entry: { targetUserId?: string | null; targetLabel?: string | null; formationId?: string | null; details?: string | null } = {}
) {
  await prisma.adminAuditLog.create({
    data: {
      actorUserId: actor.userId,
      actorLabel: actor.label,
      action,
      targetUserId: entry.targetUserId ?? null,
      targetLabel: entry.targetLabel ?? null,
      formationId: entry.formationId ?? null,
      details: entry.details ?? null,
    },
  });
}

export const AUDIT_LABELS: Record<string, string> = {
  IMPERSONATE_START: "Connexion en tant que",
  IMPERSONATE_END: "Fin de connexion en tant que",
  USER_DELETE: "Suppression de compte",
  USER_PASSWORD_SET: "Mot de passe modifié par l'admin",
  PLATFORM_ROLE_SET: "Niveau de compte modifié",
  MANAGED_FORMATION_ADD: "Session attribuée au gestionnaire",
  MANAGED_FORMATION_REMOVE: "Session retirée au gestionnaire",
  MEMBER_ADD: "Membre ajouté à l'équipe",
  MEMBER_ROLE_SET: "Rôle d'équipe modifié",
  MEMBER_REMOVE: "Membre retiré de l'équipe",
};
