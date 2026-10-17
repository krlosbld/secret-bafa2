import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isFlagged } from "@/lib/contentFilter";
import { getFormationFromCookie, hasNotStartedYet } from "@/lib/formationSession";
import { getPlayerSession } from "@/lib/playerAuth";
import { gameClosedForCurrentPlayer, isGameLaunched } from "@/lib/gameAccess";

export const runtime = "nodejs";

// Proposer son secret : il est rattaché à la fiche du compte connecté dans la session ouverte, et
// attend la décision du maître du jeu. Un seul secret actif par personne ; après un refus, la
// nouvelle proposition remplace l'ancienne (gardée dans SecretRejection) et repart en attente.
// Un stagiaire doit avoir accepté de participer au jeu lancé de sa session.
export async function POST(req: Request) {
  if (await gameClosedForCurrentPlayer()) {
    const message = "Tu ne participes pas au Jeu des secrets de cette session.";
    return NextResponse.json({ ok: false, error: message, message }, { status: 403 });
  }
  try {
    const body = await req.json();
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
    const playerSession = await getPlayerSession();
    const player = playerSession
      ? await prisma.player.findUnique({ where: { id: playerSession.playerId }, select: { id: true, formationId: true } })
      : null;
    if (!formation || !player || player.formationId !== formation.id) {
      return NextResponse.json({ ok: false, message: "Connecte-toi avec ton compte BafaPilot pour ajouter ton secret." }, { status: 401 });
    }
    if (!(await isGameLaunched(formation.id))) {
      return NextResponse.json({ ok: false, message: "Le jeu n'a pas encore été lancé par le directeur." }, { status: 403 });
    }
    if (!formation.active) {
      return NextResponse.json(
        {
          ok: false,
          message: hasNotStartedYet(formation)
            ? "Cette formation n'a pas encore commencé."
            : "Cette formation est terminée, impossible d'ajouter un secret.",
        },
        { status: 403 }
      );
    }

    const existingSecret = await prisma.secret.findUnique({ where: { playerId: player.id }, select: { id: true, status: true } });
    if (existingSecret && existingSecret.status !== "REJECTED") {
      const message =
        existingSecret.status === "PENDING"
          ? "Ton secret est déjà en attente de validation."
          : "Ton secret a déjà été validé : il est en jeu.";
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
