import { NextResponse } from "next/server";
import { applyPoints } from "@/lib/gamePoints";
import { prisma } from "@/lib/prisma";
import { getSession, isSuperAdmin } from "@/lib/auth";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

// Remet le jeu Secret BAFA de cette formation à zéro. Ne touche qu'au jeu : les joueurs (et donc
// toutes les données de la formation — planning, évaluations, fiches, comptes) sont conservés.
export async function DELETE(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { id: formationId } = await params;

  // Les faux secrets (leurres) ont un joueur fictif inactif créé pour eux : il part avec.
  const decoyPlayers = await prisma.player.findMany({
    where: { formationId, active: false, secret: { isDecoy: true }, member: { is: null } },
    select: { id: true },
  });
  const decoyIds = decoyPlayers.map((p) => p.id);

  // La remise à zéro des scores est inscrite au journal (une ligne par joueur qui avait des points) :
  // le journal des points, lui, n'est jamais effacé.
  const resetId = crypto.randomUUID();
  await prisma.$transaction(async (tx) => {
    const scored = await tx.player.findMany({ where: { formationId, points: { not: 0 } }, select: { id: true, points: true } });
    for (const p of scored) {
      await applyPoints(tx, {
        formationId,
        playerId: p.id,
        delta: -p.points,
        kind: "GAME_RESET",
        key: `reset:${resetId}:${p.id}`,
        actorLabel: "Super-admin",
        note: "Remise à zéro du jeu",
      });
    }
    await tx.gamePower.deleteMany({ where: { formationId } }); // nouvelle partie : pouvoirs de nouveau disponibles
    await tx.leaderDay.deleteMany({ where: { formationId } });
    await tx.gameChallenge.deleteMany({ where: { formationId } }); // nouvelle partie : défis effacés
    await tx.config.deleteMany({ where: { formationId, key: { startsWith: "leaderSnapshot:" } } });
    await tx.buzz.deleteMany({ where: { OR: [{ secret: { formationId } }, { fromPlayer: { formationId } }] } });
    await tx.secret.deleteMany({ where: { formationId } });
    await tx.player.deleteMany({ where: { id: { in: decoyIds } } });
    await tx.player.updateMany({
      where: { formationId },
      data: { buzzCount: 0, buzzQuotaOverride: null, isGameMaster: false, gameParticipation: null, gameParticipationAt: null, gameExitAt: null, gameExitBy: null },
    });
    // Le jeu redevient « non lancé » : le directeur pourra le relancer et les stagiaires seront réinvités.
    await tx.config.deleteMany({ where: { formationId, key: { in: ["gameEnded", "buzzPaused", "lastNightlyRun", "gameLaunchedAt", "gameLaunchedBy", "gameStartedAt", "lastNightlyAwardDate"] } } });
  });

  return NextResponse.json({ ok: true });
}
