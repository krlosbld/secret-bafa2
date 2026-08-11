import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isSuperAdmin } from "@/lib/auth";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

// PATCH : activer/désactiver cette formation et/ou modifier ses dates
export async function PATCH(req: Request, { params }: Params) {
  const session = await getSession();
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const existing = await prisma.formation.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  const data: { active?: boolean; startDate?: Date | null; endDate?: Date | null } = {};
  if (typeof body.active === "boolean") data.active = body.active;
  if ("startDate" in body) data.startDate = body.startDate ? new Date(String(body.startDate)) : null;
  if ("endDate" in body) data.endDate = body.endDate ? new Date(String(body.endDate)) : null;
  if (Object.keys(data).length === 0) data.active = true; // rétro-compat : PATCH sans body = activer

  const formation = await prisma.formation.update({ where: { id }, data });

  return NextResponse.json({ ok: true, formation });
}
