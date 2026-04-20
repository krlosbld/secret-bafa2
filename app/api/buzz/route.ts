import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fuzzyMatch } from "@/lib/fuzzy";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const secretId = String(body.secretId ?? "").trim();
    const fromName = String(body.fromName ?? "").trim();
    const fromCode = String(body.fromCode ?? "").trim();
    const guessedName = String(body.guessedName ?? "").trim();

    if (!secretId || !fromName || !fromCode || !guessedName) {
      return NextResponse.json({ error: "Champs manquants." }, { status: 400 });
    }

    // Trouver le joueur par son code
    const player = await prisma.player.findUnique({ where: { code: fromCode } });
    if (!player) {
      return NextResponse.json(
        { error: "Code invalide. Vérifie ton code personnel." },
        { status: 400 }
      );
    }

    // Vérifier que le prénom correspond au code (fuzzy)
    if (!fuzzyMatch(fromName, player.firstName)) {
      return NextResponse.json(
        { error: "Le code ne correspond pas à ce prénom." },
        { status: 400 }
      );
    }

    // Vérifier le quota
    const config = await prisma.config.findUnique({ where: { key: "buzzQuota" } });
    const quota = Number(config?.value ?? 3);
    if (player.buzzCount >= quota) {
      return NextResponse.json(
        { error: `Tu as atteint ton quota de ${quota} buzz.` },
        { status: 400 }
      );
    }

    // Vérifier que le secret existe et est publié
    const secret = await prisma.secret.findUnique({
      where: { id: secretId },
      include: { player: true },
    });
    if (!secret || secret.status === "PENDING") {
      return NextResponse.json({ error: "Secret introuvable." }, { status: 404 });
    }
    if (secret.status === "FOUND") {
      return NextResponse.json(
        { error: "Ce secret a déjà été trouvé." },
        { status: 400 }
      );
    }

    // Impossible de buzzer son propre secret
    if (secret.playerId === player.id) {
      return NextResponse.json(
        { error: "Tu ne peux pas buzzer ton propre secret." },
        { status: 400 }
      );
    }

    // Buzz déjà envoyé sur ce secret
    const existing = await prisma.buzz.findUnique({
      where: {
        secretId_fromPlayerId: { secretId, fromPlayerId: player.id },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Tu as déjà buzzé ce secret." },
        { status: 400 }
      );
    }

    // Calculer si la réponse est correcte
    const isCorrect = fuzzyMatch(guessedName, secret.player.firstName);

    // Créer le buzz et incrémenter le compteur
    await prisma.$transaction([
      prisma.buzz.create({
        data: {
          secretId,
          fromPlayerId: player.id,
          guessedName,
          status: "PENDING",
          isCorrect,
        },
      }),
      prisma.player.update({
        where: { id: player.id },
        data: { buzzCount: { increment: 1 } },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("API BUZZ ERROR:", e);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
