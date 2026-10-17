import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlanningAuth } from "@/lib/planningAuth";
import { canEditSessionSettings } from "@/lib/sessionSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// Un critère ne se modifie que dans sa propre session, par un directeur de cette session (ou l'admin).
async function sessionCriterion(id: string): Promise<{ ok: true } | { ok: false; res: NextResponse }> {
  const auth = await getPlanningAuth();
  if (!auth.ok || !(await canEditSessionSettings(auth.formationId))) {
    return { ok: false, res: NextResponse.json({ error: "Non autorisé." }, { status: 401 }) };
  }
  const criterion = await prisma.criterion.findUnique({ where: { id }, select: { formationId: true } });
  if (!criterion || criterion.formationId !== auth.formationId) {
    return { ok: false, res: NextResponse.json({ error: "Introuvable." }, { status: 404 }) };
  }
  return { ok: true };
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const check = await sessionCriterion(id);
  if (!check.ok) return check.res;

  const body = await req.json().catch(() => ({}));
  if (typeof body.label !== "string" || !body.label.trim()) {
    return NextResponse.json({ error: "Nom requis." }, { status: 400 });
  }

  const criterion = await prisma.criterion.update({ where: { id }, data: { label: body.label.trim().slice(0, 100) } });
  return NextResponse.json({ ok: true, criterion });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const check = await sessionCriterion(id);
  if (!check.ok) return check.res;

  // Le critère appartient à cette seule session : ses notes sont celles de cette session.
  const inUse = await prisma.criterionRating.count({ where: { criterionId: id } });
  if (inUse > 0) {
    return NextResponse.json(
      { error: `Ce critère a déjà ${inUse} note(s) dans cette session : il ne peut pas être supprimé.` },
      { status: 409 }
    );
  }

  await prisma.criterion.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
