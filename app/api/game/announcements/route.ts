import { NextResponse } from "next/server";
import { currentActivePlayer } from "@/lib/gameAccess";
import { getPendingRuleChanges, markRuleChangesSeen } from "@/lib/gameAnnouncements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Changements de règles pas encore vus par le participant connecté.
export async function GET() {
  const me = await currentActivePlayer();
  if (!me) return NextResponse.json({ changes: [] });
  return NextResponse.json({ changes: await getPendingRuleChanges(me.formationId, me.id) });
}

// « J'ai compris » : la fenêtre ne réapparaît plus pour ces changements.
export async function POST() {
  const me = await currentActivePlayer();
  if (!me) return NextResponse.json({ error: "Réservé aux participants." }, { status: 403 });
  await markRuleChangesSeen(me.id);
  return NextResponse.json({ ok: true });
}
