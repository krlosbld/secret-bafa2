import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canEditPlanning } from "@/lib/planningAuth";
import { DEFAULT_POSTE_CATEGORY, isValidPosteCategory } from "@/lib/planningConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const postes = await prisma.posteType.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json({ ok: true, postes });
}

export async function POST(req: Request) {
  if (!(await canEditPlanning())) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const label = String(body.label ?? "").trim().slice(0, 40);
  const color = String(body.color ?? "").trim();
  const evaluable = body.evaluable === true;
  const countedInHours = body.countedInHours !== false;
  const category =
    typeof body.category === "string" && isValidPosteCategory(body.category) ? body.category : DEFAULT_POSTE_CATEGORY;

  if (!label) {
    return NextResponse.json({ error: "Nom requis." }, { status: 400 });
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    return NextResponse.json({ error: "Couleur invalide." }, { status: 400 });
  }

  const count = await prisma.posteType.count();
  const poste = await prisma.posteType.create({
    data: { label, color, order: count, evaluable, category, countedInHours },
  });

  return NextResponse.json({ ok: true, poste });
}
