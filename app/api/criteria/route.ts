import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlanningAuth } from "@/lib/planningAuth";
import { canEditSessionSettings } from "@/lib/sessionSettings";
import { getSessionCriteria } from "@/lib/sessionCriteria";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Critères d'évaluation de la session ouverte (propres à chaque session).
export async function GET() {
  const auth = await getPlanningAuth();
  if (!auth.ok) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  return NextResponse.json({ ok: true, criteria: await getSessionCriteria(auth.formationId) });
}

export async function POST(req: Request) {
  const auth = await getPlanningAuth();
  if (!auth.ok || !(await canEditSessionSettings(auth.formationId))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const label = String(body.label ?? "").trim().slice(0, 100);
  if (!label) {
    return NextResponse.json({ error: "Nom requis." }, { status: 400 });
  }

  const existing = await getSessionCriteria(auth.formationId);
  const criterion = await prisma.criterion.create({ data: { label, order: existing.length, formationId: auth.formationId } });

  return NextResponse.json({ ok: true, criterion });
}
