import { NextResponse } from "next/server";
import { currentActivePlayer } from "@/lib/gameAccess";
import { buyFakeIdentity, getFakeIdentityState, PowerError } from "@/lib/fakeIdentity";

export const runtime = "nodejs";

// Achat de la fausse identité : { aliasPlayerId }. Débit unique au journal, une fois par partie.
export async function POST(req: Request) {
  const me = await currentActivePlayer();
  if (!me) return NextResponse.json({ error: "Réservé aux participants." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  try {
    await buyFakeIdentity({ formationId: me.formationId, playerId: me.id, aliasPlayerId: String(body.aliasPlayerId ?? "") });
  } catch (e) {
    if (e instanceof PowerError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  return NextResponse.json({ ok: true, fakeIdentity: await getFakeIdentityState(me.formationId, me.id) });
}
