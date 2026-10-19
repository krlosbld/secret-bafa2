import { NextResponse } from "next/server";
import { currentActivePlayer } from "@/lib/gameAccess";
import { getMysteryState } from "@/lib/mysteryBuzz";
import { getFakeIdentityState } from "@/lib/fakeIdentity";
import { getBountyState } from "@/lib/bounty";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// « Mes pouvoirs » du joueur connecté — ses propres données uniquement.
export async function GET() {
  const me = await currentActivePlayer();
  if (!me) return NextResponse.json({ error: "Réservé aux participants." }, { status: 403 });
  const bounty = await getBountyState(me.formationId, me.id); // règle d'abord une mise arrivée à échéance
  const [mystery, fakeIdentity] = await Promise.all([getMysteryState(me.formationId, me.id), getFakeIdentityState(me.formationId, me.id)]);
  return NextResponse.json({ ok: true, mystery, fakeIdentity, bounty });
}
