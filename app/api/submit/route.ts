import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fuzzyMatch } from "@/lib/fuzzy";
import { isFlagged } from "@/lib/contentFilter";
import { getActiveFormationId } from "@/lib/formation";

export const runtime = "nodejs";

async function generateUniqueCode(formationId: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const exists = await prisma.player.findUnique({ where: { formationId_code: { formationId, code } } });
    if (!exists) return code;
  }
  throw new Error("Impossible de générer un code unique");
}

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

    const formationId = await getActiveFormationId();

    // Un seul secret par prénom (fuzzy match strict), au sein de la formation active
    const allPlayers = await prisma.player.findMany({
      where: { formationId },
      select: { firstName: true },
    });
    const duplicate = allPlayers.some((p) => fuzzyMatch(p.firstName, firstName, 1));
    if (duplicate) {
      return NextResponse.json(
        { ok: false, message: "Un secret existe déjà pour ce prénom." },
        { status: 409 }
      );
    }

    const code = await generateUniqueCode(formationId);
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
