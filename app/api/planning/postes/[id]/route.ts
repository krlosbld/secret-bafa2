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
  const data: Record<string, unknown> = {};

  if (typeof body.label === "string" && body.label.trim().length > 0) {
    data.label = body.label.trim().slice(0, 40);
  }
  if (typeof body.color === "string" && /^#[0-9a-fA-F]{6}$/.test(body.color)) {
    data.color = body.color;
  }
  if (typeof body.evaluable === "boolean") {
    data.evaluable = body.evaluable;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucun champ valide." }, { status: 400 });
  }

  const poste = await prisma.posteType.update({ where: { id }, data }).catch(() => null);
  if (!poste) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  return NextResponse.json({ ok: true, poste });
}

export async function DELETE(_req: Request, { params }: Params) {
  if (!(await canEditPlanning())) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { id } = await params;

  const inUse = await prisma.planningBlock.count({ where: { type: id } });
  if (inUse > 0) {
    return NextResponse.json(
      { error: `Ce type est utilisé par ${inUse} créneau(x). Supprime-les d'abord.` },
      { status: 409 }
    );
  }

  const total = await prisma.posteType.count();
  if (total <= 1) {
    return NextResponse.json({ error: "Il doit rester au moins un type." }, { status: 400 });
  }

  await prisma.posteType.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
