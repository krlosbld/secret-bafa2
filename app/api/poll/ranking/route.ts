import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGameFormation } from "@/lib/gameFormation";
import { gameClosedForCurrentPlayer } from "@/lib/gameAccess";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const formation = await getGameFormation();
  if (!formation || (await gameClosedForCurrentPlayer())) return NextResponse.json({ players: [] });

  // Tous les joueurs qui ont un secret validé (PUBLISHED ou FOUND), formation du cookie uniquement
  const players = await prisma.player.findMany({
    where: {
      formationId: formation.id,
      secret: { status: { in: ["PUBLISHED", "FOUND"] } },
    },
    select: {
      id: true,
      firstName: true,
      points: true,
      secret: { select: { status: true } },
    },
    orderBy: [{ points: "desc" }, { firstName: "asc" }],
  });

  return NextResponse.json({ players });
}
