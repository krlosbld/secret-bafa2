import { NextResponse } from "next/server";
import { currentActivePlayer } from "@/lib/gameAccess";
import { activateBounty, getBountyState } from "@/lib/bounty";
import { PowerError } from "@/lib/fakeIdentity";

export const runtime = "nodejs";

// Mettre son secret à prix : { stake }. Mise retirée du score et mise en réserve, une fois par partie.
export async function POST(req: Request) {
  const me = await currentActivePlayer();
  if (!me) return NextResponse.json({ error: "Réservé aux participants." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  try {
    await activateBounty({ formationId: me.formationId, playerId: me.id, stake: Number(body.stake) });
  } catch (e) {
    if (e instanceof PowerError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  return NextResponse.json({ ok: true, bounty: await getBountyState(me.formationId, me.id) });
}
