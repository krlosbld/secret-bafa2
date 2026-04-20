import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isSuperAdmin } from "@/lib/auth";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

// PATCH : modifier points ou reset buzz
export async function PATCH(req: Request, { params }: Params) {
  const session = await getSession();
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (typeof body.points === "number" && Number.isFinite(body.points)) {
    data.points = Math.max(0, body.points);
  }
  if (body.resetBuzz === true) {
    data.buzzCount = 0;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucun champ valide." }, { status: 400 });
  }

  const updated = await prisma.player.update({ where: { id }, data });
  return NextResponse.json({ ok: true, player: updated });
}

// DELETE : supprimer un joueur (cascade sur secret et buzz)
export async function DELETE(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { id } = await params;
  await prisma.player.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
