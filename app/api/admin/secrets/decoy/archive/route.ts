import { NextResponse } from "next/server";
import { getSecretsAdminAuth } from "@/lib/gameAdminAuth";
import { resolveAdminFormationId } from "@/lib/formation";
import { findNameCollision } from "@/lib/nameCollision";
import { randomDecoy } from "@/lib/decoySecrets";
import { archiveSecretContents } from "@/lib/secretArchive";

export const runtime = "nodejs";

// « Partir d'un ancien secret » (maître du jeu) : un vrai secret validé d'une ancienne session du
// compte, sans son auteur, avec un prénom inventé. Il devra être reformulé avant d'être créé (le
// serveur refuse un texte trop proche d'un vrai secret).
export async function POST() {
  const auth = await getSecretsAdminAuth();
  if (!auth.ok) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  let formationId = auth.formationId;
  if (!formationId) {
    const resolved = await resolveAdminFormationId();
    if (!resolved.ok) return NextResponse.json({ error: "Choisis une formation." }, { status: 409 });
    formationId = resolved.formationId;
  }

  const archive = await archiveSecretContents(formationId);
  if (archive.length === 0) {
    return NextResponse.json({ error: "Aucun ancien secret disponible dans tes autres sessions." }, { status: 404 });
  }
  const content = archive[Math.floor(Math.random() * archive.length)];

  for (let i = 0; i < 10; i++) {
    const { firstName } = randomDecoy();
    if (!(await findNameCollision(formationId, firstName))) {
      return NextResponse.json({ ok: true, firstName, content, original: content, source: "archive" });
    }
  }
  return NextResponse.json({ error: "Impossible de proposer un prénom libre, réessaie." }, { status: 409 });
}
