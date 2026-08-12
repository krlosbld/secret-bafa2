import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlanningAuth } from "@/lib/planningAuth";
import { snapshotPlanning } from "@/lib/planningSnapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MIN = 9 * 60; // 09:00
const DAY_MAX = 18 * 60 + 30; // 18:30

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const auth = await getPlanningAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { id } = await params;
  const current = await prisma.planningBlock.findUnique({ where: { id } });
  if (!current || current.formationId !== auth.formationId) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (Number.isInteger(body.day) && body.day >= 0 && body.day <= 7) {
    data.day = body.day;
  }
  if (Number.isInteger(body.startMin) && body.startMin >= DAY_MIN && body.startMin % 5 === 0) {
    data.startMin = body.startMin;
  }
  if (Number.isInteger(body.endMin) && body.endMin <= DAY_MAX && body.endMin % 5 === 0) {
    data.endMin = body.endMin;
  }
  if (typeof body.label === "string") {
    data.label = body.label.trim().slice(0, 60) || "Sans titre";
  }
  if (typeof body.type === "string" && body.type.length > 0) {
    data.type = body.type;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucun champ valide." }, { status: 400 });
  }

  const nextStart = (data.startMin as number) ?? current.startMin;
  const nextEnd = (data.endMin as number) ?? current.endMin;
  if (nextEnd - nextStart < 5) {
    return NextResponse.json({ error: "Durée minimale de 5 minutes." }, { status: 400 });
  }

  await snapshotPlanning(auth.formationId);
  const updated = await prisma.planningBlock.update({ where: { id }, data });
  return NextResponse.json({ ok: true, block: updated });
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await getPlanningAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { id } = await params;
  const current = await prisma.planningBlock.findUnique({ where: { id }, select: { formationId: true } });
  if (!current || current.formationId !== auth.formationId) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  // Sécurité : un créneau supprimé entraîne la suppression en cascade des évaluations qui y sont
  // rattachées. Si un stagiaire a déjà quelque chose de rempli dessus, on refuse — la case doit rester.
  const filledEvaluations = await prisma.evaluation.count({ where: { blockId: id, note: { not: "" } } });
  if (filledEvaluations > 0) {
    return NextResponse.json(
      {
        error: `${filledEvaluations} évaluation(s) rempli(es) sur ce créneau — suppression bloquée pour ne pas les perdre.`,
      },
      { status: 409 }
    );
  }

  await snapshotPlanning(auth.formationId);
  await prisma.planningBlock.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
