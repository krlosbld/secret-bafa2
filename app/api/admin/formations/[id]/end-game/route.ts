import { NextResponse } from "next/server";
import { applyPoints } from "@/lib/gamePoints";
import { getGameMasterAuth, getGameStatus } from "@/lib/gameAccess";
import { prisma } from "@/lib/prisma";
import { getGameAdminAuth } from "@/lib/gameAdminAuth";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const auth = await getGameAdminAuth();
  const { id: formationId } = await params;
  if (!auth.ok || (auth.formationId && auth.formationId !== formationId)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const existing = await prisma.config.findUnique({
    where: { formationId_key: { formationId, key: "gameEnded" } },
  });
  if (existing?.value === "true") {
    return NextResponse.json({ error: "Le jeu est déjà terminé." }, { status: 400 });
  }
  if ((await getGameStatus(formationId)) !== "en_cours") {
    return NextResponse.json({ error: "La partie n'a pas commencé : il n'y a rien à terminer." }, { status: 409 });
  }

  const unfound = await prisma.secret.findMany({
    where: { status: "PUBLISHED", formationId, isDecoy: false }, // un faux secret n'a pas d'auteur à récompenser
    select: { id: true, playerId: true, bonus: true },
  });

  // Clôture et bonus dans une seule transaction ; un bonus par secret (clé du secret) : une fin de
  // partie relancée ne le redonne pas.
  const actor = await getGameMasterAuth();
  await prisma.$transaction(async (tx) => {
    await tx.config.upsert({
      where: { formationId_key: { formationId, key: "gameEnded" } },
      update: { value: "true" },
      create: { formationId, key: "gameEnded", value: "true" },
    });
    for (const s of unfound) {
      await applyPoints(tx, {
        formationId,
        playerId: s.playerId,
        delta: s.bonus + 10,
        kind: "END_BONUS",
        key: `end-bonus:${s.id}`,
        refType: "secret",
        refId: s.id,
        actorLabel: actor.ok ? actor.label : "Administration",
        note: "Secret jamais trouvé : bonus + 10",
      });
    }
  });

  return NextResponse.json({ ok: true, updated: unfound.length });
}
