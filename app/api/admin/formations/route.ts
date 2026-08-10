import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isSuperAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const formations = await prisma.formation.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, active: true, createdAt: true, _count: { select: { players: true } } },
  });

  return NextResponse.json({ ok: true, formations });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Nom requis." }, { status: 400 });
  }

  const formation = await prisma.$transaction(async (tx) => {
    await tx.formation.updateMany({ where: { active: true }, data: { active: false } });
    return tx.formation.create({ data: { name, active: true } });
  });

  return NextResponse.json({ ok: true, formation });
}
