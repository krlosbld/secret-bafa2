import { NextResponse } from "next/server";
import { getGameAdminAuth } from "@/lib/gameAdminAuth";
import { getGameMasterAuth } from "@/lib/gameAccess";
import { resolveAdminFormationId } from "@/lib/formation";
import { answerQuestion, MysteryError } from "@/lib/mysteryBuzz";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

// Réponse du maître du jeu : { action: "OUI" | "NON" } ou { action: "REFUSER", reason }.
export async function PATCH(req: Request, { params }: Params) {
  const auth = await getGameAdminAuth();
  if (!auth.ok) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  let formationId = auth.formationId;
  if (!formationId) {
    const resolved = await resolveAdminFormationId();
    if (!resolved.ok) return NextResponse.json({ error: "Choisis une formation." }, { status: 409 });
    formationId = resolved.formationId;
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body.action;
  if (action !== "OUI" && action !== "NON" && action !== "REFUSER") return NextResponse.json({ error: "Action invalide." }, { status: 400 });
  const gm = await getGameMasterAuth();
  try {
    await answerQuestion({ formationId, questionId: id, action, reason: body.reason, actorLabel: gm.ok ? gm.label : "Administration" });
  } catch (e) {
    if (e instanceof MysteryError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  return NextResponse.json({ ok: true });
}
