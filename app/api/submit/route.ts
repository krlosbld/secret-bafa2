import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isFlagged } from "@/lib/contentFilter";
import { getFormationFromCookie, hasNotStartedYet } from "@/lib/formationSession";
import { generateUniquePlayerCode } from "@/lib/playerCode";
import { findNameCollision } from "@/lib/nameCollision";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const firstName = String(body.firstName ?? "").trim();
    const content = String(body.content ?? "").trim();
    const bonus = Number(body.bonus ?? 1);

    if (!firstName || !content) {
      return NextResponse.json(
        { ok: false, message: "Prénom et secret obligatoires." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(bonus) || bonus < 1 || bonus > 5) {
      return NextResponse.json(
        { ok: false, message: "Le bonus doit être entre 1 et 5." },
        { status: 400 }
      );
    }

    if (firstName.length > 40 || content.length > 800) {
      return NextResponse.json(
        { ok: false, message: "Texte trop long." },
        { status: 400 }
      );
    }

    const formation = await getFormationFromCookie();
    if (!formation) {
      return NextResponse.json(
        { ok: false, message: "Code de session manquant. Retourne sur la page d'accueil." },
        { status: 400 }
      );
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
    const formationId = formation.id;

    // Un seul secret par prénom (fuzzy match strict, y compris sur le premier mot d'un nom composé),
    // au sein de la formation
    const duplicate = await findNameCollision(formationId, firstName);
    if (duplicate) {
      return NextResponse.json(
        { ok: false, message: "Un secret existe déjà pour ce prénom." },
        { status: 409 }
      );
    }

    const code = await generateUniquePlayerCode(formationId);
    const flagged = isFlagged(content);

    await prisma.player.create({
      data: {
        firstName,
        code,
        formationId,
        secret: {
          create: { content, bonus, status: "PENDING", flagged, formationId },
        },
      },
    });

    return NextResponse.json({ ok: true, code });
  } catch (e) {
    console.error("API SUBMIT ERROR:", e);
    return NextResponse.json(
      { ok: false, message: "Erreur serveur." },
      { status: 500 }
    );
  }
}
