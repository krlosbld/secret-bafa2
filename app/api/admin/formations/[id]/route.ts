import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isSuperAdmin } from "@/lib/auth";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

// PATCH : activer cette formation (désactive l'ancienne active)
export async function PATCH(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { id } = await params;

  const formation = await prisma.$transaction(async (tx) => {
    const existing = await tx.formation.findUnique({ where: { id } });
    if (!existing) return null;
    await tx.formation.updateMany({ where: { active: true }, data: { active: false } });
    return tx.formation.update({ where: { id }, data: { active: true } });
  });

  if (!formation) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  return NextResponse.json({ ok: true, formation });
}
