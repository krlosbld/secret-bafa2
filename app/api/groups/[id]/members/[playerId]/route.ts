import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlanningAuth } from "@/lib/planningAuth";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; playerId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await getPlanningAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { id, playerId } = await params;
  const group = await prisma.group.findUnique({ where: { id } });
  if (!group || group.formationId !== auth.formationId) {
    return NextResponse.json({ error: "Groupe introuvable." }, { status: 404 });
  }

  await prisma.groupMember.deleteMany({ where: { groupId: id, playerId } });
  return NextResponse.json({ ok: true });
}
