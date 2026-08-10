import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveFormationId } from "@/lib/formation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const formationId = await getActiveFormationId();

  // Tous les joueurs qui ont un secret validé (PUBLISHED ou FOUND), formation active uniquement
  const players = await prisma.player.findMany({
    where: {
      formationId,
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
