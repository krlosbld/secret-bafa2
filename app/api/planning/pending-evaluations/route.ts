import { NextResponse } from "next/server";
import { getPlayerSession } from "@/lib/playerAuth";
import { getPendingEvaluations } from "@/lib/pendingEvaluations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getPlayerSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const blocks = await getPendingEvaluations(session.playerId);
  return NextResponse.json({ ok: true, blocks });
}
