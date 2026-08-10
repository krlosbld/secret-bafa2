import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveFormationId } from "@/lib/formation";

export const runtime = "nodejs";

// Appelé chaque nuit à minuit (Vercel Cron envoie une requête GET)
// Header requis : Authorization: Bearer <CRON_SECRET>
async function runNightlyJob(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const formationId = await getActiveFormationId();

  // Reset du compteur de buzz pour les joueurs de la formation active
  await prisma.player.updateMany({ where: { formationId }, data: { buzzCount: 0 } });

  // +1 pt à chaque auteur dont le secret est PUBLISHED (pas encore trouvé)
  const unpublished = await prisma.secret.findMany({
    where: { status: "PUBLISHED", formationId },
    select: { playerId: true },
  });

  if (unpublished.length > 0) {
    await prisma.player.updateMany({
      where: { id: { in: unpublished.map((s) => s.playerId) } },
      data: { points: { increment: 1 } },
    });
  }

  await prisma.config.upsert({
    where: { formationId_key: { formationId, key: "lastNightlyRun" } },
    update: { value: JSON.stringify({ at: new Date().toISOString(), updated: unpublished.length }) },
    create: { formationId, key: "lastNightlyRun", value: JSON.stringify({ at: new Date().toISOString(), updated: unpublished.length }) },
  });

  return NextResponse.json({ ok: true, updated: unpublished.length });
}

export async function GET(req: Request) {
  return runNightlyJob(req);
}

export async function POST(req: Request) {
  return runNightlyJob(req);
}
