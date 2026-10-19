import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isFlagged } from "@/lib/contentFilter";
import { getFormationFromCookie } from "@/lib/formationSession";
import { currentActivePlayer, getGameStatus } from "@/lib/gameAccess";
import { mustReplaceSecret } from "@/lib/secretConversion";

export const runtime = "nodejs";

// Proposer son secret (fenêtre dédiée) : réservé aux stagiaires participants, pendant la phase
// d'inscription — ou pendant la partie pour un joueur dont le secret a été transformé en faux. La première proposition doit arriver dans les 24 h suivant l'acceptation (sinon la
// participation expire). Une seule proposition à la fois : après un refus, la nouvelle remplace
// l'ancienne (gardée avec son motif dans SecretRejection) et repart en attente.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const content = String(body.content ?? "").trim();
    const bonus = Number(body.bonus ?? 1);

    if (!content) {
      return NextResponse.json({ ok: false, message: "Ton secret est vide." }, { status: 400 });
    }
    if (!Number.isInteger(bonus) || bonus < 1 || bonus > 5) {
      return NextResponse.json({ ok: false, message: "Le bonus doit être entre 1 et 5." }, { status: 400 });
    }
    if (content.length > 800) {
      return NextResponse.json({ ok: false, message: "Texte trop long." }, { status: 400 });
    }

    const formation = await getFormationFromCookie();
    if (!formation) {
      return NextResponse.json({ ok: false, message: "Connecte-toi avec ton compte BafaPilot pour proposer ton secret." }, { status: 401 });
    }
    const status = await getGameStatus(formation.id);
    if (status !== "inscriptions_ouvertes" && status !== "en_cours") {
      return NextResponse.json({ ok: false, message: "Le jeu n'est pas ouvert aux propositions." }, { status: 403 });
    }
    // Délai de 24 h vérifié ici même : un traitement automatique en retard ne doit rien permettre.
    const player = await currentActivePlayer();
    if (!player || player.formationId !== formation.id) {
      const message = "Tu ne participes pas (ou plus) au Jeu des secrets de cette session.";
      return NextResponse.json({ ok: false, error: message, message }, { status: 403 });
    }
    if (status === "en_cours" && !(await mustReplaceSecret(player.id))) {
      return NextResponse.json({ ok: false, message: "La partie est en cours : les propositions de secrets sont fermées." }, { status: 403 });
    }

    const existingSecret = await prisma.secret.findUnique({ where: { playerId: player.id }, select: { id: true, status: true } });
    if (existingSecret && existingSecret.status !== "REJECTED") {
      const message =
        existingSecret.status === "PENDING"
          ? "Ton secret est déjà en attente de validation."
          : "Ton secret a déjà été validé.";
      return NextResponse.json({ ok: false, message }, { status: 409 });
    }

    if (existingSecret) {
      // Nouvelle proposition après un refus : mise à jour conditionnelle (un seul envoi gagne).
      const done = await prisma.secret.updateMany({
        where: { id: existingSecret.id, status: "REJECTED" },
        data: { content, bonus, status: "PENDING", flagged: isFlagged(content), createdAt: new Date() },
      });
      if (done.count === 0) return NextResponse.json({ ok: false, message: "Ton secret est déjà en attente de validation." }, { status: 409 });
    } else {
      const created = await prisma.secret
        .create({ data: { playerId: player.id, formationId: formation.id, content, bonus, status: "PENDING", flagged: isFlagged(content) } })
        .catch(() => null); // envoi simultané : la contrainte « un secret par joueur » a déjà tranché
      if (!created) return NextResponse.json({ ok: false, message: "Ton secret est déjà en attente de validation." }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("API SUBMIT ERROR:", e);
    return NextResponse.json({ ok: false, message: "Erreur serveur." }, { status: 500 });
  }
}
