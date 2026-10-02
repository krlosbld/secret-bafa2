import { NextResponse } from "next/server";
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

  await prisma.$transaction([
    prisma.buzz.deleteMany({ where: { OR: [{ secret: { formationId } }, { fromPlayer: { formationId } }] } }),
    prisma.secret.deleteMany({ where: { formationId } }),
    prisma.player.deleteMany({ where: { id: { in: decoyIds } } }),
    prisma.player.updateMany({ where: { formationId }, data: { points: 0, buzzCount: 0, buzzQuotaOverride: null } }),
    prisma.config.deleteMany({ where: { formationId, key: { in: ["gameEnded", "buzzPaused", "lastNightlyRun"] } } }),
  ]);

  return NextResponse.json({ ok: true });
}
