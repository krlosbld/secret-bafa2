import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlanningAuth } from "@/lib/planningAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const auth = await getPlanningAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (typeof body.active !== "boolean") {
    return NextResponse.json({ error: "Champ 'active' requis." }, { status: 400 });
  }

  const existing = await prisma.player.findUnique({ where: { id }, select: { formationId: true } });
  if (!existing || existing.formationId !== auth.formationId) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  const player = await prisma.player.update({ where: { id }, data: { active: body.active } });

  return NextResponse.json({ ok: true, player });
}
