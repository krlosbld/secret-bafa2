import { NextResponse } from "next/server";
import { currentActivePlayer } from "@/lib/gameAccess";
import { ChallengeError, pendingChallengesForPlayer, respondToChallenge } from "@/lib/gameChallenges";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Défis du maître du jeu qui attendent la réponse du joueur connecté.
export async function GET() {
  const me = await currentActivePlayer();
  if (!me) return NextResponse.json({ challenges: [] });
  return NextResponse.json({ challenges: await pendingChallengesForPlayer(me.id) });
}

// Réponse du joueur : { id, accept: boolean }.
export async function POST(req: Request) {
  const me = await currentActivePlayer();
  if (!me) return NextResponse.json({ error: "Réservé aux participants." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.id !== "string" || typeof body.accept !== "boolean") return NextResponse.json({ error: "Réponse invalide." }, { status: 400 });
  try {
    await respondToChallenge({ playerId: me.id, recipientId: body.id, accept: body.accept });
  } catch (e) {
    if (e instanceof ChallengeError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  return NextResponse.json({ ok: true });
}
