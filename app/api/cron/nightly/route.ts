import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Appelé chaque nuit à minuit (via cron externe ou Vercel Cron)
// Header requis : Authorization: Bearer <CRON_SECRET>
export async function POST(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  // +1 pt à chaque auteur dont le secret est PUBLISHED (pas encore trouvé)
  const unpublished = await prisma.secret.findMany({
    where: { status: "PUBLISHED" },
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
