import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getGameStatus } from "@/lib/gameAccess";
import { sendChallengeEmail } from "@/lib/mail";

// Défis du maître du jeu : un message qu'il rédige, envoyé à tous les joueurs ou à certains, et que
// chaque destinataire accepte ou refuse (fenêtre à la connexion + email « Tu as reçu un message du
// maître du jeu », sans le texte du défi). Pas de points automatiques. Date limite optionnelle :
// passé ce délai, la réponse n'est plus possible. Fin de partie ou annulation : réponses closes.
export class ChallengeError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export const CHALLENGE_MAX_LENGTH = 1000;

// Destinataires possibles : les joueurs de la partie (participants acceptés), jamais le maître du jeu
// ni les faux secrets. hasEmail : compte BafaPilot avec une adresse (sinon, fenêtre seulement).
export async function challengeRecipientsChoice(formationId: string) {
  const players = await prisma.player.findMany({
    where: { formationId, active: true, isGameMaster: false, gameParticipation: "ACCEPTED" },
    orderBy: { firstName: "asc" },
    select: { id: true, firstName: true, member: { select: { user: { select: { email: true } } } } },
  });
  return players.map((p) => ({ id: p.id, firstName: p.firstName, hasEmail: !!p.member?.user.email }));
}

export async function createChallenge(params: {
  formationId: string;
  text: string;
  deadline: Date | null;
  playerIds: string[] | "ALL";
  actorLabel: string;
  now?: Date;
}): Promise<string> {
  const now = params.now ?? new Date();
  const status = await getGameStatus(params.formationId);
  if (status !== "inscriptions_ouvertes" && status !== "en_cours") throw new ChallengeError("Les défis ne sont possibles que pendant les inscriptions ou la partie.", 409);
  const text = params.text.trim();
  if (!text) throw new ChallengeError("Écris le défi.");
  if (text.length > CHALLENGE_MAX_LENGTH) throw new ChallengeError(`Le défi ne doit pas dépasser ${CHALLENGE_MAX_LENGTH} caractères.`);
  if (params.deadline && params.deadline.getTime() <= now.getTime()) throw new ChallengeError("La date limite doit être dans le futur.");
  const eligible = await challengeRecipientsChoice(params.formationId);
  const ids = params.playerIds === "ALL" ? eligible.map((p) => p.id) : [...new Set(params.playerIds)];
  if (ids.length === 0) throw new ChallengeError("Choisis au moins un joueur.");
  const allowed = new Set(eligible.map((p) => p.id));
  if (ids.some((id) => !allowed.has(id))) throw new ChallengeError("Un des destinataires ne participe pas à la partie.");
  const challenge = await prisma.gameChallenge.create({
    data: {
      formationId: params.formationId,
      text,
      deadline: params.deadline,
      createdBy: params.actorLabel,
      recipients: { create: ids.map((playerId) => ({ playerId })) },
    },
    select: { id: true },
  });
  return challenge.id;
}

// Emails « Tu as reçu un message du maître du jeu » : un par destinataire, l'un après l'autre (pas de
// rafale de connexions SMTP). Un échec n'annule pas le défi : il est noté (FAILED) pour le maître du jeu.
export async function sendChallengeMails(challengeId: string) {
  const recipients = await prisma.gameChallengeRecipient.findMany({
    where: { challengeId, mailStatus: null },
    select: {
      id: true,
      player: { select: { firstName: true, formation: { select: { name: true } }, member: { select: { user: { select: { email: true } } } } } },
    },
  });
  for (const r of recipients) {
    const email = r.player.member?.user.email;
    let mailStatus = "NO_EMAIL";
    if (email) {
      const sent = await sendChallengeEmail(email, r.player.firstName, r.player.formation.name).catch(() => ({ ok: false as const }));
      mailStatus = sent.ok ? "SENT" : "FAILED";
    }
    await prisma.gameChallengeRecipient.update({ where: { id: r.id }, data: { mailStatus } });
  }
}

// Défis en attente de la réponse du joueur (non annulés, dans les délais).
export async function pendingChallengesForPlayer(playerId: string, now: Date = new Date()) {
  const rows = await prisma.gameChallengeRecipient.findMany({
    where: {
      playerId,
      status: "PENDING",
      challenge: { cancelledAt: null, OR: [{ deadline: null }, { deadline: { gt: now } }] },
    },
    orderBy: { challenge: { createdAt: "asc" } },
    select: { id: true, challenge: { select: { text: true, deadline: true, createdAt: true } } },
  });
  return rows.map((r) => ({ id: r.id, text: r.challenge.text, deadline: r.challenge.deadline?.toISOString() ?? null, createdAt: r.challenge.createdAt.toISOString() }));
}
export type PendingChallenge = Awaited<ReturnType<typeof pendingChallengesForPlayer>>[number];

export async function respondToChallenge(params: { playerId: string; recipientId: string; accept: boolean; now?: Date }) {
  const now = params.now ?? new Date();
  const done = await prisma.gameChallengeRecipient.updateMany({
    where: {
      id: params.recipientId,
      playerId: params.playerId,
      status: "PENDING",
      challenge: { cancelledAt: null, OR: [{ deadline: null }, { deadline: { gt: now } }] },
    },
    data: { status: params.accept ? "ACCEPTED" : "REFUSED", respondedAt: now },
  });
  if (done.count === 0) throw new ChallengeError("Ce défi n'attend plus de réponse (déjà répondu, annulé ou délai dépassé).", 409);
}

// Annulation par le maître du jeu : les réponses en attente sont closes, celles déjà données restent.
export async function cancelChallenge(formationId: string, challengeId: string) {
  await prisma.$transaction(async (tx) => {
    const done = await tx.gameChallenge.updateMany({ where: { id: challengeId, formationId, cancelledAt: null }, data: { cancelledAt: new Date() } });
    if (done.count === 0) throw new ChallengeError("Ce défi est déjà annulé (ou n'existe pas).", 409);
    await tx.gameChallengeRecipient.updateMany({ where: { challengeId, status: "PENDING" }, data: { status: "CANCELLED" } });
  });
}

// Fin de partie : plus de réponse possible aux défis en attente.
export async function closePendingChallenges(tx: Prisma.TransactionClient, formationId: string) {
  await tx.gameChallengeRecipient.updateMany({ where: { status: "PENDING", challenge: { formationId } }, data: { status: "CLOSED" } });
}

// Suivi pour le maître du jeu : 30 derniers défis, état de chaque destinataire (EXPIRED = en attente
// au-delà de la date limite).
export async function challengesForAdmin(formationId: string, now: Date = new Date()) {
  const rows = await prisma.gameChallenge.findMany({
    where: { formationId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      text: true,
      deadline: true,
      createdBy: true,
      createdAt: true,
      cancelledAt: true,
      recipients: { orderBy: { player: { firstName: "asc" } }, select: { id: true, status: true, respondedAt: true, mailStatus: true, player: { select: { firstName: true } } } },
    },
  });
  return rows.map((c) => {
    const expired = !!c.deadline && c.deadline.getTime() <= now.getTime();
    return {
      ...c,
      recipients: c.recipients.map((r) => ({
        id: r.id,
        firstName: r.player.firstName,
        status: r.status === "PENDING" && expired ? "EXPIRED" : r.status,
        respondedAt: r.respondedAt,
        mailStatus: r.mailStatus,
      })),
    };
  });
}
