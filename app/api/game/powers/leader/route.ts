import { NextResponse } from "next/server";
import { currentActivePlayer } from "@/lib/gameAccess";
import { chooseLeaderPrivilege, getLeaderState, LeaderError } from "@/lib/leaderPrivilege";

export const runtime = "nodejs";

// Choix du privilège du jour : { choice: "EXTRA_BUZZ" | "QUESTION" | "HISTORY" } — une fois, avant 18 h.
export async function POST(req: Request) {
  const me = await currentActivePlayer();
  if (!me) return NextResponse.json({ error: "Réservé aux participants." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  try {
    await chooseLeaderPrivilege({ formationId: me.formationId, playerId: me.id, choice: String(body.choice ?? "") });
  } catch (e) {
    if (e instanceof LeaderError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  return NextResponse.json({ ok: true, leader: await getLeaderState(me.formationId, me.id) });
}

// État du privilège du jour (fenêtre « Tu es en tête du classement »).
export async function GET() {
  const me = await currentActivePlayer();
  if (!me) return NextResponse.json({ leader: null });
  return NextResponse.json({ leader: await getLeaderState(me.formationId, me.id) });
}
