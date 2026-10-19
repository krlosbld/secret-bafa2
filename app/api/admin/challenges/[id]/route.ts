import { NextResponse } from "next/server";
import { getGameAdminAuth } from "@/lib/gameAdminAuth";
import { resolveAdminFormationId } from "@/lib/formation";
import { cancelChallenge, ChallengeError } from "@/lib/gameChallenges";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

// Annulation d'un défi par le maître du jeu (réponses en attente closes).
export async function DELETE(_req: Request, { params }: Params) {
  const auth = await getGameAdminAuth();
  if (!auth.ok) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  let formationId = auth.formationId;
  if (!formationId) {
    const resolved = await resolveAdminFormationId();
    if (!resolved.ok) return NextResponse.json({ error: "Choisis une formation." }, { status: 409 });
    formationId = resolved.formationId;
  }
  const { id } = await params;
  try {
    await cancelChallenge(formationId, id);
  } catch (e) {
    if (e instanceof ChallengeError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  return NextResponse.json({ ok: true });
}
