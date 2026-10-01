import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isFlagged } from "@/lib/contentFilter";
import { getFormationFromCookie, hasNotStartedYet } from "@/lib/formationSession";
import { getPlayerSession } from "@/lib/playerAuth";

export const runtime = "nodejs";

// Ajouter son secret : il est rattaché à la fiche du compte connecté dans la session ouverte.
// Plus de prénom à saisir ni de code à noter, et plus aucune fiche créée depuis le jeu.
export async function POST(req: Request) {
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

    const existingSecret = await prisma.secret.findUnique({ where: { playerId: player.id } });
    if (existingSecret) {
      return NextResponse.json({ ok: false, message: "Tu as déjà ajouté ton secret." }, { status: 409 });
    }

    await prisma.secret.create({
      data: { playerId: player.id, formationId: formation.id, content, bonus, status: "PENDING", flagged: isFlagged(content) },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("API SUBMIT ERROR:", e);
    return NextResponse.json({ ok: false, message: "Erreur serveur." }, { status: 500 });
  }
}
