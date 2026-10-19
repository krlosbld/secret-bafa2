import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { matchesName } from "@/lib/nameCollision";
import { CLAIM_FAKE_GUESS_LABEL } from "@/lib/buzzResolution";
import { isSecretCurrentlyVisible } from "@/lib/secretVisibility";
import { getFormationFromCookie, hasNotStartedYet } from "@/lib/formationSession";
import { getPlayerSession } from "@/lib/playerAuth";
import { currentActivePlayer, getGameStatus } from "@/lib/gameAccess";
import { isWithinBuzzHours } from "@/lib/buzzWindow";
import { claimFakeSecret } from "@/lib/buzzClaims";
import { evaluateNameBuzz } from "@/lib/fakeIdentity";
import { extraBuzzToday } from "@/lib/leaderPrivilege";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!(await currentActivePlayer())) {
    return NextResponse.json({ ok: false, error: "Seuls les participants au Jeu des secrets peuvent buzzer." }, { status: 403 });
  }
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
    const guessedName = claimFake ? CLAIM_FAKE_GUESS_LABEL : String(body.guessedName ?? "").trim();

    const missingFields = claimFake ? !secretId : !secretId || !guessedName;
    if (missingFields) {
      return NextResponse.json({ error: "Champs manquants." }, { status: 400 });
    }

    const formation = await getFormationFromCookie();
    if (!formation) {
      return NextResponse.json({ error: "Ouvre ta session depuis « Mes sessions » (connexion avec ton compte BafaPilot)." }, { status: 400 });
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

    const [gameEndedConfig, lockPendingCorrectConfig, buzzPausedConfig] = await Promise.all([
      prisma.config.findUnique({ where: { formationId_key: { formationId, key: "gameEnded" } } }),
      prisma.config.findUnique({ where: { formationId_key: { formationId, key: "rule_lockPendingCorrect" } } }),
      prisma.config.findUnique({ where: { formationId_key: { formationId, key: "buzzPaused" } } }),
    ]);
    if (gameEndedConfig?.value === "true") {
      return NextResponse.json({ error: "Le jeu est terminé, il n'est plus possible de buzzer." }, { status: 403 });
    }
    if ((await getGameStatus(formationId)) !== "en_cours") {
      return NextResponse.json({ error: "La partie n'a pas encore commencé : les buzz seront possibles au démarrage." }, { status: 403 });
    }
    if (buzzPausedConfig?.value === "true") {
      return NextResponse.json({ error: "Les buzz sont temporairement suspendus." }, { status: 403 });
    }
    const lockPendingCorrect = lockPendingCorrectConfig?.value === "true";

    // Le joueur est celui du compte connecté, dans la session ouverte (plus de code à taper).
    const playerSession = await getPlayerSession();
    const player = playerSession ? await prisma.player.findUnique({ where: { id: playerSession.playerId } }) : null;
    if (!player || player.formationId !== formationId) {
      return NextResponse.json({ error: "Connecte-toi avec ton compte BafaPilot pour buzzer." }, { status: 401 });
    }

    // Le maître du jeu voit tous les secrets : il ne peut pas buzzer (garde-fou, il n'est pas participant).
    if (player.isGameMaster) {
      return NextResponse.json(
        { error: "En tant que maître du jeu, tu ne peux pas buzzer." },
        { status: 403 }
      );
    }

    // Vérifier le quota (override personnel s'il existe, sinon quota de la formation)
    const config = await prisma.config.findUnique({ where: { formationId_key: { formationId, key: "buzzQuota" } } });
    // Privilège du leader « un buzz de plus » : +1 ce jour-là seulement.
    const quota = (player.buzzQuotaOverride ?? Number(config?.value ?? 3)) + (await extraBuzzToday(formationId, player.id));
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
    // Ni son ancien secret transformé en faux par le maître du jeu (il en connaît le texte).
    if (secret.convertedFromPlayerId === player.id) {
      return NextResponse.json({ error: "C'était ton secret : tu ne peux pas buzzer dessus." }, { status: 400 });
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
    // Prénom : évalué à l'heure de l'envoi, fausse identité éventuelle comprise (jamais révélée).
    const submittedAt = new Date();
    const evaluation = claimFake
      ? { isCorrect: secret.isDecoy, camouflagePowerId: null }
      : await evaluateNameBuzz({ authorPlayerId: secret.playerId, authorFirstName: secret.player.firstName, guessedName, at: submittedAt });
    const isCorrect = evaluation.isCorrect;

    // Une réclamation "faux secret" a une réponse binaire déjà connue du logiciel (secret.isDecoy) —
    // contrairement à une devinette de prénom (correspondance floue, pas fiable à 100%), elle se
    // résout immédiatement dans les deux sens, sans passer par la file de validation manuelle.
    let claimFakeResult: { correct: boolean; points?: number } | undefined;

    if (claimFake) {
      const result = await claimFakeSecret({
        secretId,
        playerId: player.id,
        formationId,
        isDecoy: secret.isDecoy,
        bonus: secret.bonus,
        authorFirstName: secret.player.firstName,
      });
      if (result.alreadyFound) {
        return NextResponse.json({ error: "Ce secret vient d'être trouvé par quelqu'un d'autre." }, { status: 409 });
      }
      claimFakeResult = result.correct ? { correct: true, points: result.points } : { correct: false };
    } else {
      await prisma.$transaction([
        prisma.buzz.create({
          data: { secretId, fromPlayerId: player.id, guessedName, status: "PENDING", isCorrect, camouflagePowerId: evaluation.camouflagePowerId, createdAt: submittedAt },
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