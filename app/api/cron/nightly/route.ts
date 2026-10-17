import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { todayISO } from "@/lib/planningConfig";
import { expireOverdueParticipants, getGameStatus } from "@/lib/gameAccess";

export const runtime = "nodejs";

const AUTO_DEACTIVATE_GRACE_DAYS = 7;

// Réserve l'attribution du jour pour une session : true une seule fois par date de Paris.
async function claimNightlyAward(formationId: string): Promise<boolean> {
  const day = todayISO();
  const key = "lastNightlyAwardDate";
  const updated = await prisma.config.updateMany({ where: { formationId, key, NOT: { value: day } }, data: { value: day } });
  if (updated.count === 1) return true;
  if (await prisma.config.findUnique({ where: { formationId_key: { formationId, key } } })) return false; // déjà fait aujourd'hui
  return prisma.config
    .create({ data: { formationId, key, value: day } })
    .then(() => true)
    .catch(() => false); // créé en parallèle par un autre passage
}

// Appelé chaque nuit à minuit (Vercel Cron envoie une requête GET)
// Header requis : Authorization: Bearer <CRON_SECRET>
async function runNightlyJob(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  // startDate/endDate sont stockés comme "minuit UTC du jour visé en heure de Paris" (ex. un input
  // <date>) — comparer avec new Date() (l'instant UTC réel) décale la bascule de ~2h en été et peut
  // faire manquer la fenêtre d'un jour entier puisque ce cron ne tourne qu'une fois par nuit. On
  // compare donc à la date du jour à Paris, reconstruite avec le même biais, pour rester cohérent.
  const todayAsStoredMidnight = new Date(`${todayISO()}T00:00:00.000Z`);

  // Active automatiquement les formations dont la date de début est atteinte.
  const activated = await prisma.formation.updateMany({
    where: { active: false, startDate: { lte: todayAsStoredMidnight } },
    data: { active: true },
  });

  // Désactive automatiquement les formations dont la date de fin est dépassée depuis trop longtemps.
  const deactivated = await prisma.formation.updateMany({
    where: {
      active: true,
      endDate: { lt: new Date(todayAsStoredMidnight.getTime() - AUTO_DEACTIVATE_GRACE_DAYS * 24 * 60 * 60 * 1000) },
    },
    data: { active: false },
  });

  await expireOverdueParticipants();
  const activeFormations = await prisma.formation.findMany({ where: { active: true }, select: { id: true } });

  const results: { formationId: string; updated: number }[] = [];
  for (const { id: formationId } of activeFormations) {
    // Reset du compteur de buzz pour les joueurs de cette formation
    await prisma.player.updateMany({ where: { formationId }, data: { buzzCount: 0 } });

    // +1 pt par secret validé pas encore trouvé, seulement pendant une partie EN COURS (rien pendant
    // les inscriptions ni après la fin), et une seule fois par jour (date de Paris) même si le
    // traitement est relancé : le jour est « réservé » de façon atomique avant d'attribuer.
    const playing = (await getGameStatus(formationId)) === "en_cours";
    const awardToday = playing && (await claimNightlyAward(formationId));
    const unpublished = !awardToday
      ? []
      : await prisma.secret.findMany({
          where: { status: "PUBLISHED", formationId, isDecoy: false }, // pas de points pour un faux secret
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
