import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJsonBody } from "@/lib/requestGuard";
import { audit } from "@/lib/adminActor";
import { getGameMasterAuth, getGameStatus, GAME_STARTED_KEY } from "@/lib/gameAccess";
import { getGameFormation } from "@/lib/gameFormation";
import { loadReadiness } from "@/lib/gameReadiness";

export const runtime = "nodejs";

// « Commencer le jeu » (maître du jeu) : en une seule opération,
// - valide et publie les secrets en attente des inscrits (et les faux secrets en attente) ;
// - exclut les inscrits sans secret ou dont le secret a été refusé, et ceux qui n'ont pas répondu
//   à l'invitation (rien n'est supprimé : participation EXCLUDED, date, motif ; secret refusé retiré) ;
// - ferme définitivement les inscriptions, rend les secrets visibles et ouvre les buzz.
// Refusé s'il ne reste aucun joueur.
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
  const { startPlan: plan } = await loadReadiness(formationId);
  if (plan.players === 0) {
    return NextResponse.json({ error: "Aucun inscrit n'a proposé de secret : la partie ne peut pas commencer." }, { status: 409 });
  }

  const now = new Date();
  const started = await prisma
    .$transaction(async (tx) => {
      // Création conditionnelle en premier : un double clic ne démarre (ni n'exclut) pas deux fois.
      await tx.config.create({ data: { formationId, key: GAME_STARTED_KEY, value: now.toISOString() } });
      const published = await tx.secret.updateMany({
        where: { formationId, status: "PENDING", OR: [{ isDecoy: true }, { playerId: { in: plan.publish.map((p) => p.id) } }] },
        data: { status: "PUBLISHED" },
      });
      if (plan.excludeNoSecret.length > 0) {
        const ids = plan.excludeNoSecret.map((p) => p.id);
        await tx.player.updateMany({
          where: { id: { in: ids }, formationId, gameParticipation: "ACCEPTED" },
          data: { gameParticipation: "EXCLUDED", gameExitAt: now, gameExitBy: "Démarrage du jeu (pas de secret validé)" },
        });
        await tx.secret.updateMany({ where: { playerId: { in: ids }, status: "REJECTED" }, data: { status: "WITHDRAWN", limitedVisibility: false } });
      }
      if (plan.excludeNoAnswer.length > 0) {
        await tx.player.updateMany({
          where: { id: { in: plan.excludeNoAnswer.map((p) => p.id) }, formationId, gameParticipation: null },
          data: { gameParticipation: "EXCLUDED", gameExitAt: now, gameExitBy: "Démarrage du jeu (pas de réponse à l'invitation)" },
        });
      }
      return published.count;
    })
    .catch((e: unknown) => {
      if ((e as { code?: string }).code === "P2002") return null; // marqueur déjà posé
      throw e;
    });
  if (started === null) return NextResponse.json({ error: "La partie a déjà commencé." }, { status: 409 });

  await audit({ kind: "directeur", userId: null, label: auth.label }, "GAME_STARTED", {
    formationId,
    details: `${plan.players} joueur(s) · ${started} secret(s) publié(s) au démarrage · ${plan.excludeNoSecret.length} exclu(s) sans secret · ${plan.excludeNoAnswer.length} exclu(s) sans réponse`,
  });
  return NextResponse.json({ ok: true, players: plan.players, published: started, excluded: plan.excludeNoSecret.length + plan.excludeNoAnswer.length });
}
