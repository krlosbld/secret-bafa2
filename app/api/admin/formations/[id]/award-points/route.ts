import { NextResponse } from "next/server";
import { getGameStatus } from "@/lib/gameAccess";
import { prisma } from "@/lib/prisma";
import { getGameAdminAuth } from "@/lib/gameAdminAuth";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const auth = await getGameAdminAuth();
  const { id: formationId } = await params;
  if (!auth.ok || (auth.formationId && auth.formationId !== formationId)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  if ((await getGameStatus(formationId)) !== "en_cours") {
    return NextResponse.json({ error: "Les points ne s'attribuent que pendant la partie." }, { status: 409 });
  }

  const unpublished = await prisma.secret.findMany({
    where: { status: "PUBLISHED", formationId, isDecoy: false }, // un faux secret n'a pas d'auteur à récompenser
    select: { playerId: true },
  });

  if (unpublished.length > 0) {
    await prisma.player.updateMany({
      where: { id: { in: unpublished.map((s) => s.playerId) } },
      data: { points: { increment: 1 } },
    });
  }

  return NextResponse.json({ ok: true, updated: unpublished.length });
}
