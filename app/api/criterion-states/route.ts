import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canEditPlanning } from "@/lib/planningAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const states = await prisma.criterionState.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json({ ok: true, states });
}

export async function POST(req: Request) {
  if (!(await canEditPlanning())) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const label = String(body.label ?? "").trim().slice(0, 40);
  const color = String(body.color ?? "").trim();
  const score = body.score === null ? null : Number(body.score);

  if (!label) {
    return NextResponse.json({ error: "Nom requis." }, { status: 400 });
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    return NextResponse.json({ error: "Couleur invalide." }, { status: 400 });
  }
  if (score !== null && (!Number.isFinite(score) || score < -1 || score > 2)) {
    return NextResponse.json({ error: "Score invalide (entre -1 et 2, ou vide)." }, { status: 400 });
  }

  const count = await prisma.criterionState.count();
  const state = await prisma.criterionState.create({
    data: { label, color, score, order: count },
  });

  return NextResponse.json({ ok: true, state });
}
