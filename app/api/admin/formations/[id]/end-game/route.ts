import { NextResponse } from "next/server";
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

  const existing = await prisma.config.findUnique({
    where: { formationId_key: { formationId, key: "gameEnded" } },
  });
  if (existing?.value === "true") {
    return NextResponse.json({ error: "Le jeu est déjà terminé." }, { status: 400 });
  }

  const unfound = await prisma.secret.findMany({
    where: { status: "PUBLISHED", formationId },
    select: { playerId: true, bonus: true },
  });

  await prisma.$transaction([
    ...unfound.map((s) =>
      prisma.player.update({
        where: { id: s.playerId },
        data: { points: { increment: s.bonus + 10 } },
      })
    ),
    prisma.config.upsert({
      where: { formationId_key: { formationId, key: "gameEnded" } },
      update: { value: "true" },
      create: { formationId, key: "gameEnded", value: "true" },
    }),
  ]);

  return NextResponse.json({ ok: true, updated: unfound.length });
}
