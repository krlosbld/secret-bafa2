import { NextResponse } from "next/server";
import { applyPointsOnce, requestKey } from "@/lib/gamePoints";
import { getGameMasterAuth, getGameStatus } from "@/lib/gameAccess";
import { prisma } from "@/lib/prisma";
import { getGameAdminAuth } from "@/lib/gameAdminAuth";
import { authorsAwaitingNewSecret } from "@/lib/secretConversion";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const body = await req.json().catch(() => ({}));
  const auth = await getGameAdminAuth();
  const { id: formationId } = await params;
  if (!auth.ok || (auth.formationId && auth.formationId !== formationId)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  if ((await getGameStatus(formationId)) !== "en_cours") {
    return NextResponse.json({ error: "Les points ne s'attribuent que pendant la partie." }, { status: 409 });
  }

  const unpublished = await prisma.secret.findMany({
    where: { status: "PUBLISHED", formationId, isDecoy: false }, // un faux secret n'a pas d'auteur à récompenser
    select: { playerId: true },
  });
  // Secret transformé en faux : l'auteur garde son point en attendant son nouveau secret.
  for (const playerId of await authorsAwaitingNewSecret(formationId)) {
    if (!unpublished.some((u) => u.playerId === playerId)) unpublished.push({ playerId });
  }

  // Une clé par clic (fournie par l'interface) : un double clic n'attribue qu'une fois.
  const request = requestKey(body.requestId);
  const actor = await getGameMasterAuth();
  for (const { playerId } of unpublished) {
    await applyPointsOnce({
      formationId,
      playerId,
      delta: 1,
      kind: "MANUAL_AWARD",
      key: `manual-award:${request}:${playerId}`,
      actorLabel: actor.ok ? actor.label : "Administration",
      note: "+1 point (secret non trouvé), attribué à la main",
    });
  }

  return NextResponse.json({ ok: true, updated: unpublished.length });
}
