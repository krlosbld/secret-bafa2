import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJsonBody } from "@/lib/requestGuard";
import { getPlayerSession } from "@/lib/playerAuth";
import { getGameState } from "@/lib/gameAccess";

export const runtime = "nodejs";

// Réponse d'un stagiaire à l'invitation au Jeu des secrets de sa session. Définitive : un second
// choix est refusé (un refus ne peut pas être contourné, une participation ne se retire pas ici).
export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;
  const choice = body.choice === "ACCEPTED" || body.choice === "DECLINED" ? body.choice : null;
  if (!choice) return NextResponse.json({ error: "Choix invalide." }, { status: 400 });

  const playerSession = await getPlayerSession();
  const player = playerSession
    ? await prisma.player.findUnique({ where: { id: playerSession.playerId }, select: { id: true, role: true, formationId: true, gameParticipation: true } })
    : null;
  if (!player || player.role !== "STAGIAIRE") return NextResponse.json({ error: "Réservé aux stagiaires de la session." }, { status: 403 });

  const state = await getGameState(player.formationId);
  if (!state.launched || state.ended) return NextResponse.json({ error: "Le jeu n'est pas ouvert aux inscriptions." }, { status: 409 });

  // Mise à jour conditionnelle : seule la première réponse compte, même en cas de double clic.
  const done = await prisma.player.updateMany({
    where: { id: player.id, gameParticipation: null },
    data: { gameParticipation: choice, gameParticipationAt: new Date() },
  });
  if (done.count === 0) return NextResponse.json({ error: "Tu as déjà répondu pour cette session." }, { status: 409 });
  return NextResponse.json({ ok: true, choice });
}
