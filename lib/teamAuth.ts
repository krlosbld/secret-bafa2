import { NextResponse } from "next/server";
import { canManageFormation } from "@/lib/access";
import { getManagerActor, getSuperAdminActor, type AdminActor } from "@/lib/adminActor";

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
