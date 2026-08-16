import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const AUTO_DEACTIVATE_GRACE_DAYS = 7;

// Appelé chaque nuit à minuit (Vercel Cron envoie une requête GET)
// Header requis : Authorization: Bearer <CRON_SECRET>
async function runNightlyJob(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  // Active automatiquement les formations dont la date de début est atteinte.
  const activated = await prisma.formation.updateMany({
    where: { active: false, startDate: { lte: new Date() } },
    data: { active: true },
  });

  // Désactive automatiquement les formations dont la date de fin est dépassée depuis trop longtemps.
  const deactivated = await prisma.formation.updateMany({
    where: {
      active: true,
      endDate: { lt: new Date(Date.now() - AUTO_DEACTIVATE_GRACE_DAYS * 24 * 60 * 60 * 1000) },
    },
    data: { active: false },
  });

  const activeFormations = await prisma.formation.findMany({ where: { active: true }, select: { id: true } });

  const results: { formationId: string; updated: number }[] = [];
  for (const { id: formationId } of activeFormations) {
    // Reset du compteur de buzz pour les joueurs de cette formation
    await prisma.player.updateMany({ where: { formationId }, data: { buzzCount: 0 } });

    // Une fois le jeu terminé ("Terminer le jeu"), les secrets non trouvés ont déjà reçu leur bonus
    // final — ne pas continuer à leur donner +1 pt chaque nuit indéfiniment.
    const gameEndedConfig = await prisma.config.findUnique({
      where: { formationId_key: { formationId, key: "gameEnded" } },
    });
    const gameEnded = gameEndedConfig?.value === "true";

    // +1 pt à chaque auteur dont le secret est PUBLISHED (pas encore trouvé)
    const unpublished = gameEnded
      ? []
      : await prisma.secret.findMany({
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

    results.push({ formationId, updated: unpublished.length });
  }

  return NextResponse.json({ ok: true, activated: activated.count, deactivated: deactivated.count, results });
}

export async function GET(req: Request) {
  return runNightlyJob(req);
}

export async function POST(req: Request) {
  return runNightlyJob(req);
}
