import { NextResponse } from "next/server";
import { applyPointsOnce, InsufficientPointsError, requestKey } from "@/lib/gamePoints";
import { wrongNamesFor } from "@/lib/wrongNames";
import { prisma } from "@/lib/prisma";
import { historyRevealCost } from "@/lib/buzzResolution";
import { getFormationFromCookie, hasNotStartedYet } from "@/lib/formationSession";
import { getPlayerSession } from "@/lib/playerAuth";
import { currentActivePlayer, getGameStatus } from "@/lib/gameAccess";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  // Révélation payante : participants seulement, partie en cours.
  const active = await currentActivePlayer();
  if (!active || (await getGameStatus(active.formationId)) !== "en_cours") {
    return NextResponse.json({ ok: false, error: "Réservé aux participants, pendant la partie." }, { status: 403 });
  }
  const { id: secretId } = await params;
  const formation = await getFormationFromCookie();
  if (!formation) {
    return NextResponse.json({ error: "Ouvre ta session depuis « Mes sessions » (connexion avec ton compte BafaPilot)." }, { status: 400 });
  }
  if (!formation.active) {
    return NextResponse.json(
      {
        error: hasNotStartedYet(formation)
          ? "Cette formation n'a pas encore commencé."
          : "Cette formation est terminée.",
      },
      { status: 403 }
    );
  }
  const formationId = formation.id;

  const ruleConfig = await prisma.config.findUnique({
    where: { formationId_key: { formationId, key: "rule_paidSecretHistory" } },
  });
  if (ruleConfig?.value !== "true") {
    return NextResponse.json({ error: "Cette option n'est pas activée." }, { status: 403 });
  }

  const playerSession = await getPlayerSession();
  const player = playerSession ? await prisma.player.findUnique({ where: { id: playerSession.playerId } }) : null;
  if (!player || player.formationId !== formationId) {
    return NextResponse.json({ error: "Connecte-toi avec ton compte BafaPilot." }, { status: 401 });
  }

  const secret = await prisma.secret.findUnique({ where: { id: secretId } });
  if (!secret || secret.formationId !== formationId || secret.status === "PENDING") {
    return NextResponse.json({ error: "Secret introuvable." }, { status: 404 });
  }
  if (secret.status === "FOUND") {
    return NextResponse.json({ error: "Ce secret a déjà été trouvé." }, { status: 400 });
  }

  const cost = historyRevealCost(secret);
  // Débit au journal, solde vérifié sous verrou ; une clé par ouverture de la fenêtre : un double clic
  // ne débite qu'une fois.
  const body = await _req.json().catch(() => ({}));
  try {
    await applyPointsOnce({
      formationId,
      playerId: player.id,
      delta: -cost,
      kind: "HISTORY_REVEAL",
      key: `history:${player.id}:${secretId}:${requestKey(body.requestId)}`,
      refType: "secret",
      refId: secretId,
      requireFunds: true,
      note: "Historique payant d'un secret",
    });
  } catch (e) {
    if (e instanceof InsufficientPointsError) return NextResponse.json({ error: `Il te faut au moins ${cost} points.` }, { status: 400 });
    throw e;
  }

  const wrongNames = await wrongNamesFor(secretId);

  const updated = await prisma.player.findUnique({ where: { id: player.id }, select: { points: true } });

  return NextResponse.json({ ok: true, wrongNames, pointsRemaining: updated?.points ?? 0 });
}
