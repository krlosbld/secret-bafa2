import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fuzzyMatch } from "@/lib/fuzzy";
import { getFormationFromCookie, hasNotStartedYet } from "@/lib/formationSession";

export const runtime = "nodejs";

function isWithinBuzzHours(): boolean {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const totalMin = hour * 60 + minute;

  return totalMin >= 9 * 60 && totalMin < 18 * 60; // 09h00 à 17h59
}

export async function POST(req: Request) {
  try {
    if (!isWithinBuzzHours()) {
      return NextResponse.json(
        { error: "Les buzz ne sont possibles qu'entre 9h00 et 17h59." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const secretId = String(body.secretId ?? "").trim();
    const fromName = String(body.fromName ?? "").trim();
    const fromCode = String(body.fromCode ?? "").trim();
    const guessedName = String(body.guessedName ?? "").trim();

    if (!secretId || !fromName || !fromCode || !guessedName) {
      return NextResponse.json({ error: "Champs manquants." }, { status: 400 });
    }

    const formation = await getFormationFromCookie();
    if (!formation) {
      return NextResponse.json({ error: "Code de session manquant. Retourne sur la page d'accueil." }, { status: 400 });
    }
    if (!formation.active) {
      return NextResponse.json(
        {
          error: hasNotStartedYet(formation)
            ? "Cette formation n'a pas encore commencé."
            : "Cette formation est terminée, impossible de buzzer.",
        },
        { status: 403 }
      );
    }
    const formationId = formation.id;

    // Trouver le joueur par son code
    const player = await prisma.player.findUnique({ where: { formationId_code: { formationId, code: fromCode } } });
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

    // Vérifier le quota (override personnel s'il existe, sinon quota de la formation)
    const config = await prisma.config.findUnique({ where: { formationId_key: { formationId, key: "buzzQuota" } } });
    const quota = player.buzzQuotaOverride ?? Number(config?.value ?? 3);
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

    // Notification Telegram
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (token && chatId) {
      const msg = `🔔 Nouveau buzz !\n👤 ${player.firstName} devine : "${guessedName}"`;
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: msg }),
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("API BUZZ ERROR:", e);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}