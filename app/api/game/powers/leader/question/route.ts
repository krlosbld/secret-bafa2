import { NextResponse } from "next/server";
import { currentActivePlayer } from "@/lib/gameAccess";
import { askLeaderQuestion, getLeaderState } from "@/lib/leaderPrivilege";
import { MysteryError } from "@/lib/mysteryBuzz";

export const runtime = "nodejs";

// Question du privilège du leader : { secretId, text } — avant 18 h ; réponse du maître du jeu plus tard.
export async function POST(req: Request) {
  const me = await currentActivePlayer();
  if (!me) return NextResponse.json({ error: "Réservé aux participants." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  try {
    await askLeaderQuestion({ formationId: me.formationId, playerId: me.id, secretId: String(body.secretId ?? ""), text: String(body.text ?? "") });
  } catch (e) {
    if (e instanceof MysteryError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  return NextResponse.json({ ok: true, leader: await getLeaderState(me.formationId, me.id) });
}
