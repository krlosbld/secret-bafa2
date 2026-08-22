import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { matchesName } from "@/lib/nameCollision";
import { resolveWinningBuzz } from "@/lib/buzzResolution";
import { isSecretCurrentlyVisible } from "@/lib/secretVisibility";
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
    const claimFake = body.claimFake === true;
    const fromName = String(body.fromName ?? "").trim();
    const fromCode = String(body.fromCode ?? "").trim();
    const guessedName = claimFake ? "🎭 Pense que c'est un faux secret" : String(body.guessedName ?? "").trim();

    const missingFields = claimFake ? !secretId || !fromCode : !secretId || !fromName || !fromCode || !guessedName;
    if (missingFields) {
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

    const [gameEndedConfig, lockPendingCorrectConfig] = await Promise.all([
      prisma.config.findUnique({ where: { formationId_key: { formationId, key: "gameEnded" } } }),
      prisma.config.findUnique({ where: { formationId_key: { formationId, key: "rule_lockPendingCorrect" } } }),
    ]);
    if (gameEndedConfig?.value === "true") {
      return NextResponse.json({ error: "Le jeu est terminé, il n'est plus possible de buzzer." }, { status: 403 });
    }
    const lockPendingCorrect = lockPendingCorrectConfig?.value === "true";

    // Trouver le joueur par son code
    const player = await prisma.player.findUnique({ where: { formationId_code: { formationId, code: fromCode } } });
    if (!player) {
      return NextResponse.json(
        { error: "Code invalide. Vérifie ton code personnel." },
        { status: 400 }
      );
    }

    // Vérifier que le prénom correspond au code (fuzzy) — inutile en mode "faux secret", le code
    // suffit déjà à identifier le joueur sans lui redemander son prénom.
    if (!claimFake && !matchesName(player.firstName, fromName)) {
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
    if (!isSecretCurrentlyVisible(secret)) {
      return NextResponse.json(
        { error: "Ce secret n'est pas visible en ce moment." },
        { status: 400 }
      );
    }
    if (lockPendingCorrect) {
      const pendingCorrectOnThisSecret = await prisma.buzz.findFirst({
        where: { secretId, status: "PENDING", isCorrect: true },
      });
      if (pendingCorrectOnThisSecret) {
        return NextResponse.json(
          { error: "Une bonne réponse est déjà en attente de validation pour ce secret." },
          { status: 400 }
        );
      }
    }

    // Impossible de buzzer son propre secret
    if (secret.playerId === player.id) {
      return NextResponse.json(
        { error: "Tu ne peux pas buzzer ton propre secret." },
        { status: 400 }
      );
    }

    // Chaque personne n'a qu'un seul secret : si celui de la personne devinée a déjà été trouvé
    // (sur n'importe quel autre secret), cette réponse ne peut plus être correcte nulle part. Avec
    // la règle "verrouiller dès qu'une bonne réponse est en attente", ça s'étend aussi aux buzz
    // corrects pas encore validés — leur secret n'est pas encore FOUND, mais leur prénom est déjà
    // provisoirement pris. Non pertinent en mode "faux secret", qui ne devine aucun nom.
    if (!claimFake) {
      const foundSecrets = await prisma.secret.findMany({
        where: { formationId, status: "FOUND" },
        include: { player: { select: { firstName: true } } },
      });
      let takenNames = foundSecrets.map((s) => s.player.firstName);

      if (lockPendingCorrect) {
        const pendingCorrectElsewhere = await prisma.buzz.findMany({
          where: { status: "PENDING", isCorrect: true, secret: { formationId } },
          select: { secret: { select: { player: { select: { firstName: true } } } } },
        });
        takenNames = takenNames.concat(pendingCorrectElsewhere.map((b) => b.secret.player.firstName));
      }

      const alreadyTaken = takenNames.find((name) => matchesName(name, guessedName));
      if (alreadyTaken) {
        return NextResponse.json(
          { error: `Le secret de ${alreadyTaken} a déjà été trouvé (ou est en attente de validation) — ce n'est plus une réponse possible.` },
          { status: 400 }
        );
      }
    }

    // Calculer si la réponse est correcte
    const isCorrect = claimFake ? secret.isDecoy : matchesName(secret.player.firstName, guessedName);

    // Une réclamation "faux secret" a une réponse binaire déjà connue du logiciel (secret.isDecoy) —
    // contrairement à une devinette de prénom (correspondance floue, pas fiable à 100%), elle se
    // résout immédiatement dans les deux sens, sans passer par la file de validation manuelle.
    let claimFakeResult: { correct: boolean; points?: number } | undefined;

    if (claimFake) {
      const buzz = await prisma.buzz.create({
        data: { secretId, fromPlayerId: player.id, guessedName, status: isCorrect ? "PENDING" : "REJECTED", isCorrect },
      });
      await prisma.player.update({ where: { id: player.id }, data: { buzzCount: { increment: 1 } } });

      if (isCorrect) {
        const points = await resolveWinningBuzz({
          buzzId: buzz.id,
          secretId,
          fromPlayerId: player.id,
          secretBonus: secret.bonus,
          secretIsDecoy: secret.isDecoy,
          secretPlayerFirstName: secret.player.firstName,
          formationId,
        });
        claimFakeResult = { correct: true, points };
      } else {
        claimFakeResult = { correct: false };
      }
    } else {
      await prisma.$transaction([
        prisma.buzz.create({
          data: { secretId, fromPlayerId: player.id, guessedName, status: "PENDING", isCorrect },
        }),
        prisma.player.update({
          where: { id: player.id },
          data: { buzzCount: { increment: 1 } },
        }),
      ]);
    }

    // Notification Telegram
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (token && chatId) {
      const msg = claimFake
        ? `🔔 Nouveau buzz !\n👤 ${player.firstName} pense que c'est un faux secret 🎭 (${isCorrect ? "correct" : "incorrect"})`
        : `🔔 Nouveau buzz !\n👤 ${player.firstName} devine : "${guessedName}"`;
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: msg }),
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, claimFakeResult });
  } catch (e) {
    console.error("API BUZZ ERROR:", e);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}