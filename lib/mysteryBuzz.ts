import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getGameStatus } from "@/lib/gameAccess";
import { getRuleSettings } from "@/lib/gameRuleSettings";
import { isWithinBuzzHours, BUZZ_WINDOW_LABEL } from "@/lib/buzzWindow";
import { isSecretCurrentlyVisible } from "@/lib/secretVisibility";

// Buzz mystère ❓ (règle rule_mysteryBuzz, désactivée par défaut) : une fois par partie, un joueur pose
// au maître du jeu une question fermée sur un secret. Règles :
// - envoi pendant la partie, aux horaires du jeu (9 h – 17 h 59) ; ne consomme pas le quota de buzz ;
// - une seule question en cours à la fois ; le droit n'est consommé que par une réponse Oui / Non ;
//   une question refusée (motif) ne le consomme pas : le joueur reformule ;
// - réponse possible plus tard, même hors horaires ou si la règle a été désactivée entre-temps ;
// - à la fin de la partie, les questions sans réponse sont closes ;
// - privée : seuls le joueur et le maître du jeu la voient (aucune API publique ne la renvoie).
export const MYSTERY_RULE = "rule_mysteryBuzz";
export const QUESTION_MIN = 8;
export const QUESTION_MAX = 300;

export class MysteryError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export type MyQuestion = {
  id: string;
  secretContent: string;
  text: string;
  status: string;
  answer: string | null;
  refusalReason: string | null;
  createdAt: string;
  answeredAt: string | null;
};

export type MysteryState = {
  enabled: boolean; // règle active dans la session
  available: boolean; // le joueur peut envoyer une question maintenant
  reason: string | null; // pourquoi ce n'est pas possible
  questions: MyQuestion[]; // ses propres questions (les plus récentes d'abord)
};

export async function getMysteryState(formationId: string, playerId: string, now = new Date()): Promise<MysteryState> {
  const [settings, status, rows] = await Promise.all([
    getRuleSettings(formationId),
    getGameStatus(formationId),
    prisma.secretQuestion.findMany({
      where: { formationId, playerId, source: "MYSTERY" },
      orderBy: { createdAt: "desc" },
      include: { secret: { select: { content: true } } },
    }),
  ]);
  const questions: MyQuestion[] = rows.map((q) => ({
    id: q.id,
    secretContent: q.secret.content,
    text: q.text,
    status: q.status,
    answer: q.answer,
    refusalReason: q.refusalReason,
    createdAt: q.createdAt.toISOString(),
    answeredAt: q.answeredAt?.toISOString() ?? null,
  }));
  const enabled = settings.enabled[MYSTERY_RULE];
  let reason: string | null = null;
  if (!enabled) reason = "Le Buzz mystère n'est pas activé dans cette partie.";
  else if (status !== "en_cours") reason = "Le Buzz mystère n'est possible que pendant la partie.";
  else if (rows.some((q) => q.status === "ANSWERED")) reason = "Tu as déjà utilisé ton Buzz mystère pour cette partie.";
  else if (rows.some((q) => q.status === "PENDING")) reason = "Ta question attend la réponse du maître du jeu.";
  else if (!isWithinBuzzHours(now)) reason = `Le Buzz mystère s'envoie ${BUZZ_WINDOW_LABEL}.`;
  return { enabled, available: reason === null, reason, questions };
}

// Contrôles communs à toute question au maître du jeu (Buzz mystère, privilège du leader).
export function cleanQuestionText(raw: string): string {
  const text = raw.trim().replace(/\s+/g, " ");
  if (text.length < QUESTION_MIN || text.length > QUESTION_MAX) {
    throw new MysteryError(`Ta question doit faire entre ${QUESTION_MIN} et ${QUESTION_MAX} caractères.`);
  }
  if (!text.endsWith("?")) throw new MysteryError("Formule une question fermée, qui se termine par « ? » (réponse oui ou non).");
  return text;
}

export async function checkQuestionSecret(formationId: string, playerId: string, secretId: string) {
  const secret = await prisma.secret.findUnique({ where: { id: secretId } });
  if (!secret || secret.formationId !== formationId || secret.status !== "PUBLISHED") {
    throw new MysteryError("Ce secret n'est pas (ou plus) en jeu.", 404);
  }
  if (secret.playerId === playerId) throw new MysteryError("Tu ne peux pas poser de question sur ton propre secret.");
  if (!isSecretCurrentlyVisible(secret)) throw new MysteryError("Ce secret n'est pas visible en ce moment.");
}

export async function askMysteryQuestion(params: { formationId: string; playerId: string; secretId: string; text: string; now?: Date }) {
  const { formationId, playerId, secretId } = params;
  const text = cleanQuestionText(params.text);

  const settings = await getRuleSettings(formationId);
  if (!settings.enabled[MYSTERY_RULE]) throw new MysteryError("Le Buzz mystère n'est pas activé dans cette partie.", 403);
  if ((await getGameStatus(formationId)) !== "en_cours") throw new MysteryError("Le Buzz mystère n'est possible que pendant la partie.", 403);
  if (!isWithinBuzzHours(params.now)) throw new MysteryError(`Le Buzz mystère s'envoie ${BUZZ_WINDOW_LABEL}.`, 403);

  await checkQuestionSecret(formationId, playerId, secretId);

  // Verrou sur le joueur : deux envois simultanés (double clic) ne créent pas deux questions.
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Player" WHERE "id" = ${playerId} FOR UPDATE`;
    const used = await tx.secretQuestion.findFirst({
      where: { formationId, playerId, source: "MYSTERY", status: { in: ["PENDING", "ANSWERED"] } },
      select: { status: true },
    });
    if (used?.status === "ANSWERED") throw new MysteryError("Tu as déjà utilisé ton Buzz mystère pour cette partie.", 409);
    if (used?.status === "PENDING") throw new MysteryError("Ta question attend déjà la réponse du maître du jeu.", 409);
    return tx.secretQuestion.create({ data: { formationId, playerId, secretId, source: "MYSTERY", text } });
  });
}

// Réponse du maître du jeu : OUI / NON (consomme le droit) ou REFUSER avec un motif (ne le consomme pas).
// Conditionnelle : une question déjà traitée (double clic, autre onglet) ne change plus.
export async function answerQuestion(params: {
  formationId: string;
  questionId: string;
  action: "OUI" | "NON" | "REFUSER";
  reason?: string;
  actorLabel: string;
}) {
  const reason = (params.reason ?? "").trim().slice(0, 300);
  if (params.action === "REFUSER" && !reason) throw new MysteryError("Indique au joueur pourquoi tu refuses sa question (il pourra la reformuler).");
  const data: Prisma.SecretQuestionUpdateManyMutationInput =
    params.action === "REFUSER"
      ? { status: "REFUSED", refusalReason: reason, answeredBy: params.actorLabel, answeredAt: new Date() }
      : { status: "ANSWERED", answer: params.action, answeredBy: params.actorLabel, answeredAt: new Date() };
  const done = await prisma.secretQuestion.updateMany({
    where: { id: params.questionId, formationId: params.formationId, status: "PENDING" },
    data,
  });
  if (done.count === 0) throw new MysteryError("Cette question a déjà été traitée (ou n'existe pas).", 409);
}

// Fin de partie : les questions sans réponse sont closes (droit non consommé, plus utilisable).
export async function closePendingQuestions(tx: Prisma.TransactionClient, formationId: string) {
  await tx.secretQuestion.updateMany({
    where: { formationId, status: "PENDING" },
    data: { status: "CLOSED", refusalReason: "Partie terminée avant la réponse.", answeredAt: new Date() },
  });
}
