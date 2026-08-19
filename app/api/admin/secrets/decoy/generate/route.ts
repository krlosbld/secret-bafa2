import { NextResponse } from "next/server";
import { getGameAdminAuth } from "@/lib/gameAdminAuth";
import { resolveAdminFormationId } from "@/lib/formation";
import { findNameCollision } from "@/lib/nameCollision";
import { randomDecoy } from "@/lib/decoySecrets";

export const runtime = "nodejs";

export async function POST() {
  const auth = await getGameAdminAuth();
  if (!auth.ok) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  let formationId = auth.formationId;
  if (!formationId) {
    const resolved = await resolveAdminFormationId();
    if (!resolved.ok) return NextResponse.json({ error: "Choisis une formation." }, { status: 409 });
    formationId = resolved.formationId;
  }

  // Quelques essais pour éviter de proposer un prénom qui existe déjà dans la formation.
  for (let i = 0; i < 10; i++) {
    const proposal = randomDecoy();
    const collision = await findNameCollision(formationId, proposal.firstName);
    if (!collision) {
      return NextResponse.json({ ok: true, ...proposal });
    }
  }

  return NextResponse.json({ error: "Impossible de proposer un faux secret sans collision, réessaie." }, { status: 409 });
}
