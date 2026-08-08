import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canEditPlanning } from "@/lib/planningAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const criteria = await prisma.criterion.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json({ ok: true, criteria });
}

export async function POST(req: Request) {
  if (!(await canEditPlanning())) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const label = String(body.label ?? "").trim().slice(0, 100);
  if (!label) {
    return NextResponse.json({ error: "Nom requis." }, { status: 400 });
  }

  const count = await prisma.criterion.count();
  const criterion = await prisma.criterion.create({ data: { label, order: count } });

  return NextResponse.json({ ok: true, criterion });
}
