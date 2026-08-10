import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFormationFromCookie } from "@/lib/formationSession";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const formation = await getFormationFromCookie();
  if (!formation) return NextResponse.json({ players: [] });

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
