import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJsonBody } from "@/lib/requestGuard";
import { audit } from "@/lib/adminActor";
import { getGameMasterAuth, getGameStatus, GAME_STARTED_KEY } from "@/lib/gameAccess";
import { getGameFormation } from "@/lib/gameFormation";
import { loadReadiness } from "@/lib/gameReadiness";

export const runtime = "nodejs";

// « Commencer le jeu » (maître du jeu) : ferme définitivement les inscriptions, rend visibles les
// secrets validés et ouvre les buzz. Refusé tant qu'un participant actif n'a pas de secret validé.
export async function POST(req: Request) {
  const auth = await getGameMasterAuth();
  if (!auth.ok) return NextResponse.json({ error: "Réservé au maître du jeu." }, { status: 403 });
  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;
  const formationId = auth.formationId ?? (await getGameFormation())?.id ?? null;
  if (!formationId) return NextResponse.json({ error: "Aucune session ouverte." }, { status: 409 });

  if ((await getGameStatus(formationId)) !== "inscriptions_ouvertes") {
    return NextResponse.json({ error: "La partie ne peut être commencée que pendant les inscriptions." }, { status: 409 });
  }
  const readiness = await loadReadiness(formationId);
  if (!readiness.canStart) {
    const who = readiness.blockers.map((b) => b.firstName).join(", ");
    return NextResponse.json(
      { error: readiness.active.length === 0 ? "Aucun participant n'a encore de secret validé." : `Il reste des participants sans secret validé : ${who}.` },
      { status: 409 }
    );
  }

  // Création conditionnelle : un double clic ne démarre pas deux fois.
  const started = await prisma.config
    .create({ data: { formationId, key: GAME_STARTED_KEY, value: new Date().toISOString() } })
    .then(() => true)
    .catch(() => false);
  if (!started) return NextResponse.json({ error: "La partie a déjà commencé." }, { status: 409 });
  await audit({ kind: "directeur", userId: null, label: auth.label }, "GAME_STARTED", {
    formationId,
    details: `${readiness.ready.length} participant(s)`,
  });
  return NextResponse.json({ ok: true });
}
