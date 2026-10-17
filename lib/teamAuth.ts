import { NextResponse } from "next/server";
import { canManageFormation } from "@/lib/access";
import { getManagerActor, getSuperAdminActor, type AdminActor } from "@/lib/adminActor";
import { getVerifiedUser } from "@/lib/userSession";
import { prisma } from "@/lib/prisma";

// Droit d'administrer l'équipe d'une formation : super-admin, ou gestionnaire à qui elle est attribuée.
export async function requireFormationManager(formationId: string): Promise<AdminActor | NextResponse> {
  const actor = await getManagerActor();
  if (!actor || (actor.kind === "gestionnaire" && !(await canManageFormation(formationId)))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }
  return actor;
}

export async function requireSuperAdmin(): Promise<AdminActor | NextResponse> {
  const actor = await getSuperAdminActor();
  return actor ?? NextResponse.json({ error: "Non autorisé." }, { status: 403 });
}

// Inviter (ou annuler l'invitation d') un membre de l'équipe : super-admin et gestionnaire de la
// session, pour tous les rôles ; un directeur de CETTE session, seulement pour des formateurs.
export async function requireTeamInviter(formationId: string): Promise<{ actor: AdminActor; formateursOnly: boolean } | NextResponse> {
  const manager = await getManagerActor();
  if (manager && (manager.kind !== "gestionnaire" || (await canManageFormation(formationId)))) {
    return { actor: manager, formateursOnly: false };
  }
  const user = await getVerifiedUser();
  if (user) {
    const member = await prisma.formationMember.findUnique({
      where: { formationId_userId: { formationId, userId: user.id } },
      select: { role: true },
    });
    if (member?.role === "DIRECTEUR") {
      return {
        actor: { kind: "directeur", userId: user.id, label: `${user.firstName} ${user.lastName} <${user.email}> (directeur)` },
        formateursOnly: true,
      };
    }
  }
  return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
}
