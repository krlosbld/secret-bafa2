import { NextResponse } from "next/server";
import { getPlanningAuth } from "@/lib/planningAuth";
import { canEditSessionSettings } from "@/lib/sessionSettings";
import { getSessionCriteriaWithUsage } from "@/lib/sessionCriteria";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Critères de la session ouverte avec leur nombre d'appréciations (écran de réglages).
export async function GET() {
  const auth = await getPlanningAuth();
  if (!auth.ok || !(await canEditSessionSettings(auth.formationId))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  return NextResponse.json({ ok: true, criteria: await getSessionCriteriaWithUsage(auth.formationId) });
}
