import { NextResponse } from "next/server";
import { currentActivePlayer } from "@/lib/gameAccess";
import { askMysteryQuestion, getMysteryState, MysteryError } from "@/lib/mysteryBuzz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Buzz mystère du joueur connecté : uniquement SES questions, jamais celles des autres.
export async function GET() {
  const me = await currentActivePlayer();
  if (!me) return NextResponse.json({ error: "Réservé aux participants." }, { status: 403 });
  return NextResponse.json({ ok: true, ...(await getMysteryState(me.formationId, me.id)) });
}

export async function POST(req: Request) {
  const me = await currentActivePlayer();
  if (!me) return NextResponse.json({ error: "Réservé aux participants." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  try {
    await askMysteryQuestion({ formationId: me.formationId, playerId: me.id, secretId: String(body.secretId ?? ""), text: String(body.text ?? "") });
  } catch (e) {
    if (e instanceof MysteryError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  return NextResponse.json({ ok: true, ...(await getMysteryState(me.formationId, me.id)) });
}
