import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  // Tous les joueurs qui ont un secret validé (PUBLISHED ou FOUND)
  const players = await prisma.player.findMany({
    where: {
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
