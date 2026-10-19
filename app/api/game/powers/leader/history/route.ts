import { NextResponse } from "next/server";
import { currentActivePlayer } from "@/lib/gameAccess";
import { consultFreeHistory, getLeaderState, LeaderError } from "@/lib/leaderPrivilege";

export const runtime = "nodejs";

// Historique gratuit du privilège du leader : { secretId } — une consultation, prénoms seulement.
export async function POST(req: Request) {
  const me = await currentActivePlayer();
  if (!me) return NextResponse.json({ error: "Réservé aux participants." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  try {
    await consultFreeHistory({ formationId: me.formationId, playerId: me.id, secretId: String(body.secretId ?? "") });
  } catch (e) {
    if (e instanceof LeaderError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  return NextResponse.json({ ok: true, leader: await getLeaderState(me.formationId, me.id) });
}
