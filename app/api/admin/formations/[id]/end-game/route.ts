import { NextResponse } from "next/server";
import { applyPoints } from "@/lib/gamePoints";
import { closePendingQuestions } from "@/lib/mysteryBuzz";
import { endPowersAtGameEnd } from "@/lib/fakeIdentity";
import { settleBountiesAtGameEnd } from "@/lib/bounty";
import { closePendingChallenges } from "@/lib/gameChallenges";
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

  // Classement final juste : la partie ne se termine pas tant que des buzz attendent une décision
  // (sinon un secret en attente d'une bonne réponse serait payé deux fois : bonus de fin à l'auteur
  // puis points au joueur qui l'a trouvé, après un classement annoncé comme définitif).
  const pendingBuzzes = await prisma.buzz.count({ where: { status: "PENDING", secret: { formationId } } });
  if (pendingBuzzes > 0) {
    return NextResponse.json(
      { error: `${pendingBuzzes} buzz en attente de décision : valide-les ou rejette-les avant de terminer la partie (le classement final en dépend).`, pendingBuzzes },
      { status: 409 }
    );
  }

  const actor = await getGameMasterAuth();
  const unfoundCount = await prisma.$transaction(async (tx) => {
    // Re-vérifié dans la transaction : un buzz arrivé entre-temps bloque aussi la clôture.
    if ((await tx.buzz.count({ where: { status: "PENDING", secret: { formationId } } })) > 0) throw new PendingBuzzError();
    const unfound = await tx.secret.findMany({
      where: { status: "PUBLISHED", formationId, isDecoy: false }, // un faux secret n'a pas d'auteur à récompenser
      select: { id: true, playerId: true, bonus: true },
    });
    await closePendingQuestions(tx, formationId); // questions sans réponse : closes
    await closePendingChallenges(tx, formationId); // défis sans réponse : clos
    await settleBountiesAtGameEnd(tx, formationId); // mises à prix non réglées : rendues (une seule fois)
    await endPowersAtGameEnd(tx, formationId); // plus aucun pouvoir actif
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
    return unfound.length;
  }).catch((e) => {
    if (e instanceof PendingBuzzError) return null;
    throw e;
  });
  if (unfoundCount === null) {
    return NextResponse.json({ error: "Un buzz vient d'arriver : traite-le avant de terminer la partie." }, { status: 409 });
  }

  return NextResponse.json({ ok: true, updated: unfoundCount });
}

class PendingBuzzError extends Error {}
