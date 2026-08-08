import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canEditPlanning } from "@/lib/planningAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  if (!(await canEditPlanning())) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (typeof body.label !== "string" || !body.label.trim()) {
    return NextResponse.json({ error: "Nom requis." }, { status: 400 });
  }

  const criterion = await prisma.criterion
    .update({ where: { id }, data: { label: body.label.trim().slice(0, 100) } })
    .catch(() => null);
  if (!criterion) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  return NextResponse.json({ ok: true, criterion });
}

export async function DELETE(_req: Request, { params }: Params) {
  if (!(await canEditPlanning())) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { id } = await params;

  const inUse = await prisma.criterionRating.count({ where: { criterionId: id } });
  if (inUse > 0) {
    return NextResponse.json(
      { error: `Ce critère a déjà ${inUse} note(s) enregistrée(s). Supprime-les d'abord.` },
      { status: 409 }
    );
  }

  await prisma.criterion.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
