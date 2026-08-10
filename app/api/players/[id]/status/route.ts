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

  if (typeof body.active !== "boolean") {
    return NextResponse.json({ error: "Champ 'active' requis." }, { status: 400 });
  }

  const player = await prisma.player.update({ where: { id }, data: { active: body.active } }).catch(() => null);
  if (!player) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  return NextResponse.json({ ok: true, player });
}
