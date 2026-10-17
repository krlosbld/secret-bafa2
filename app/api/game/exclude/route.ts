import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJsonBody } from "@/lib/requestGuard";
import { audit } from "@/lib/adminActor";
import { getGameMasterAuth, getGameStatus } from "@/lib/gameAccess";
import { getGameFormation } from "@/lib/gameFormation";

export const runtime = "nodejs";

// « Exclure du jeu » (maître du jeu, pendant les inscriptions uniquement) : le participant perd
// définitivement l'accès à cette partie. Rien n'est supprimé : sa participation passe à EXCLUDED
// (date + auteur) et un secret éventuel à WITHDRAWN (conservé, hors jeu). Sa formation n'est pas touchée.
export async function POST(req: Request) {
  const auth = await getGameMasterAuth();
  if (!auth.ok) return NextResponse.json({ error: "Réservé au maître du jeu." }, { status: 403 });
  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;
  const formationId = auth.formationId ?? (await getGameFormation())?.id ?? null;
  if (!formationId) return NextResponse.json({ error: "Aucune session ouverte." }, { status: 409 });

  if ((await getGameStatus(formationId)) !== "inscriptions_ouvertes") {
    return NextResponse.json({ error: "L'exclusion n'est possible que pendant les inscriptions." }, { status: 409 });
  }
  const player = await prisma.player.findFirst({
    where: { id: String(body.playerId ?? ""), formationId, isGameMaster: false },
    select: { id: true, firstName: true, gameParticipation: true },
  });
  if (!player) return NextResponse.json({ error: "Participant introuvable dans cette session." }, { status: 404 });
  if (player.gameParticipation !== "ACCEPTED") return NextResponse.json({ error: "Seul un participant inscrit peut être exclu." }, { status: 409 });

  await prisma.$transaction([
    prisma.player.update({ where: { id: player.id }, data: { gameParticipation: "EXCLUDED", gameExitAt: new Date(), gameExitBy: auth.label } }),
    prisma.secret.updateMany({ where: { playerId: player.id, status: { in: ["PENDING", "PUBLISHED", "REJECTED"] } }, data: { status: "WITHDRAWN", limitedVisibility: false } }),
  ]);
  await audit({ kind: "directeur", userId: null, label: auth.label }, "GAME_PARTICIPANT_EXCLUDED", { formationId, targetLabel: player.firstName });
  return NextResponse.json({ ok: true });
}
