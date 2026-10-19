import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getGameStatus } from "@/lib/gameAccess";
import { getRuleSettings } from "@/lib/gameRuleSettings";
import { parisDay, parisMinutes } from "@/lib/parisTime";
import { isWithinBuzzHours, BUZZ_WINDOW_LABEL } from "@/lib/buzzWindow";
import { checkQuestionSecret, cleanQuestionText, MysteryError } from "@/lib/mysteryBuzz";
import { wrongNamesFor } from "@/lib/wrongNames";

// Privilège quotidien du leader 👑 (règle rule_leaderPrivilege, désactivée par défaut). Règles validées :
// - à 9 h (Paris), relevé du classement : les vrais joueurs en tête (ex æquo compris, au moins 1 point),
//   jamais le maître du jeu ni les faux joueurs ; une seule attribution par jour, figée ensuite ;
//   le relevé a lieu entre 9 h et 10 h (traitement des 15 min, ou première visite) : une règle activée
//   plus tard dans la journée donne son premier privilège le lendemain matin ;
// - chaque bénéficiaire choisit UN privilège avant 18 h : un buzz de plus ce jour-là, une question
//   fermée au maître du jeu (envoyée avant 18 h, réponse possible plus tard, refus = droit conservé,
//   cumulable avec le Buzz mystère), ou l'historique gratuit d'un secret (une consultation, figée) ;
// - règle désactivée : plus de relevé ni de nouveau choix ; ce qui est déjà choisi reste utilisable ;
// - fin de partie : plus de relevé ni de choix ; les questions en attente sont closes.
export const LEADER_RULE = "rule_leaderPrivilege";
export const SNAPSHOT_FROM = 9 * 60;
export const SNAPSHOT_UNTIL = 10 * 60;
export const PRIVILEGE_UNTIL = 18 * 60;
export type LeaderChoice = "EXTRA_BUZZ" | "QUESTION" | "HISTORY";
const CHOICES: LeaderChoice[] = ["EXTRA_BUZZ", "QUESTION", "HISTORY"];

export class LeaderError extends MysteryError {}

// ── Relevé de 9 h ───────────────────────────────────────────────────────────────────────────────

// Vrais joueurs de la partie (mêmes personnes que le classement, faux joueurs exclus).
async function realPlayers(db: Prisma.TransactionClient | typeof prisma, formationId: string) {
  return db.player.findMany({
    where: { formationId, isGameMaster: false, active: true, gameParticipation: "ACCEPTED", fakeVisible: false, NOT: { secret: { is: { isDecoy: true } } } },
    select: { id: true, points: true },
  });
}

export async function snapshotLeaders(formationId?: string, now = new Date()) {
  const minutes = parisMinutes(now);
  if (minutes < SNAPSHOT_FROM || minutes >= SNAPSHOT_UNTIL) return 0;
  const day = parisDay(now);
  const formations = formationId
    ? [{ id: formationId }]
    : await prisma.config.findMany({ where: { key: LEADER_RULE, value: "true" }, select: { formationId: true } }).then((r) => r.map((x) => ({ id: x.formationId })));
  let created = 0;
  for (const { id } of formations) {
    if (!(await getRuleSettings(id)).enabled[LEADER_RULE]) continue;
    if ((await getGameStatus(id)) !== "en_cours") continue;
    // Réservation du jour (clé unique session + jour) : un seul relevé, même si plusieurs passages
    // arrivent en même temps ; le classement de cet instant fait foi pour toute la journée.
    const key = `leaderSnapshot:${day}`;
    const claimed = await prisma.config.create({ data: { formationId: id, key, value: now.toISOString() } }).then(() => true).catch(() => false);
    if (!claimed) continue;
    const players = await realPlayers(prisma, id);
    const top = Math.max(0, ...players.map((p) => p.points));
    if (top < 1) continue; // personne n'a encore de point : pas de leader ce jour-là
    const leaders = players.filter((p) => p.points === top);
    const done = await prisma.leaderDay.createMany({ data: leaders.map((p) => ({ formationId: id, day, playerId: p.id, points: p.points })), skipDuplicates: true });
    created += done.count;
  }
  return created;
}

// ── État du joueur ──────────────────────────────────────────────────────────────────────────────

export type LeaderState = {
  enabled: boolean;
  today: {
    id: string;
    points: number;
    choice: LeaderChoice | null;
    canChoose: boolean;
    reason: string | null;
    question: { id: string; text: string; status: string; answer: string | null; refusalReason: string | null; secretContent: string }[];
    canAsk: boolean;
    history: { secretContent: string; names: string[] } | null;
    canConsult: boolean;
  } | null;
  coLeaders: number; // nombre de leaders ex æquo ce jour-là (soi compris)
};

export async function getLeaderState(formationId: string, playerId: string, now = new Date()): Promise<LeaderState> {
  await snapshotLeaders(formationId, now);
  const day = parisDay(now);
  const [settings, status, row] = await Promise.all([
    getRuleSettings(formationId),
    getGameStatus(formationId),
    prisma.leaderDay.findUnique({ where: { formationId_day_playerId: { formationId, day, playerId } } }),
  ]);
  const enabled = settings.enabled[LEADER_RULE];
  if (!row) return { enabled, today: null, coLeaders: 0 };
  const beforeDeadline = parisMinutes(now) < PRIVILEGE_UNTIL;
  const playing = status === "en_cours";
  let reason: string | null = null;
  if (row.choice) reason = null;
  else if (!playing) reason = "La partie n'est plus en cours.";
  else if (!enabled) reason = "Le privilège du leader a été désactivé par le maître du jeu.";
  else if (!beforeDeadline) reason = "Le choix devait être fait avant 18 h.";
  const questions = await prisma.secretQuestion.findMany({
    where: { leaderDayId: row.id, source: "LEADER" },
    orderBy: { createdAt: "desc" },
    include: { secret: { select: { content: true } } },
  });
  const historySecret = row.historySecretId ? await prisma.secret.findUnique({ where: { id: row.historySecretId }, select: { content: true } }) : null;
  const coLeaders = await prisma.leaderDay.count({ where: { formationId, day } });
  return {
    enabled,
    coLeaders,
    today: {
      id: row.id,
      points: row.points,
      choice: (row.choice as LeaderChoice | null) ?? null,
      canChoose: !row.choice && playing && enabled && beforeDeadline,
      reason,
      question: questions.map((q) => ({ id: q.id, text: q.text, status: q.status, answer: q.answer, refusalReason: q.refusalReason, secretContent: q.secret.content })),
      canAsk:
        row.choice === "QUESTION" && playing && beforeDeadline && isWithinBuzzHours(now) && !questions.some((q) => q.status === "PENDING" || q.status === "ANSWERED"),
      history: row.historyUsedAt ? { secretContent: historySecret?.content ?? "?", names: JSON.parse(row.historyResult ?? "[]") } : null,
      canConsult: row.choice === "HISTORY" && !row.historyUsedAt && playing && beforeDeadline,
    },
  };
}

// ── Choix et utilisation ────────────────────────────────────────────────────────────────────────

async function todayRow(formationId: string, playerId: string, now: Date) {
  const row = await prisma.leaderDay.findUnique({ where: { formationId_day_playerId: { formationId, day: parisDay(now), playerId } } });
  if (!row) throw new LeaderError("Tu n'as pas de privilège du leader aujourd'hui.", 403);
  if ((await getGameStatus(formationId)) !== "en_cours") throw new LeaderError("La partie n'est plus en cours.", 403);
  if (parisMinutes(now) >= PRIVILEGE_UNTIL) throw new LeaderError("Le privilège du leader s'utilise avant 18 h.", 403);
  return row;
}

export async function chooseLeaderPrivilege(params: { formationId: string; playerId: string; choice: string; now?: Date }) {
  const now = params.now ?? new Date();
  if (!CHOICES.includes(params.choice as LeaderChoice)) throw new LeaderError("Choix inconnu.");
  const row = await todayRow(params.formationId, params.playerId, now);
  if (!(await getRuleSettings(params.formationId)).enabled[LEADER_RULE]) throw new LeaderError("Le privilège du leader a été désactivé par le maître du jeu.", 403);
  // Conditionnel : un seul choix, même en double clic.
  const done = await prisma.leaderDay.updateMany({ where: { id: row.id, choice: null }, data: { choice: params.choice, chosenAt: now } });
  if (done.count === 0) throw new LeaderError("Tu as déjà choisi ton privilège du jour.", 409);
}

// Buzz supplémentaire du jour (quota du buzz).
export async function extraBuzzToday(formationId: string, playerId: string, now = new Date()): Promise<number> {
  const row = await prisma.leaderDay.findUnique({ where: { formationId_day_playerId: { formationId, day: parisDay(now), playerId } }, select: { choice: true } });
  return row?.choice === "EXTRA_BUZZ" ? 1 : 0;
}

export async function askLeaderQuestion(params: { formationId: string; playerId: string; secretId: string; text: string; now?: Date }) {
  const now = params.now ?? new Date();
  const text = cleanQuestionText(params.text);
  const row = await todayRow(params.formationId, params.playerId, now);
  if (row.choice !== "QUESTION") throw new LeaderError("Ton privilège du jour n'est pas la question au maître du jeu.", 403);
  if (!isWithinBuzzHours(now)) throw new LeaderError(`La question s'envoie ${BUZZ_WINDOW_LABEL}.`, 403);
  await checkQuestionSecret(params.formationId, params.playerId, params.secretId);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "LeaderDay" WHERE "id" = ${row.id} FOR UPDATE`;
    const used = await tx.secretQuestion.findFirst({ where: { leaderDayId: row.id, status: { in: ["PENDING", "ANSWERED"] } }, select: { status: true } });
    if (used?.status === "ANSWERED") throw new LeaderError("Ta question du jour a déjà reçu sa réponse.", 409);
    if (used?.status === "PENDING") throw new LeaderError("Ta question du jour attend déjà la réponse du maître du jeu.", 409);
    return tx.secretQuestion.create({
      data: { formationId: params.formationId, playerId: params.playerId, secretId: params.secretId, source: "LEADER", leaderDayId: row.id, text },
    });
  });
}

export async function consultFreeHistory(params: { formationId: string; playerId: string; secretId: string; now?: Date }) {
  const now = params.now ?? new Date();
  const row = await todayRow(params.formationId, params.playerId, now);
  if (row.choice !== "HISTORY") throw new LeaderError("Ton privilège du jour n'est pas l'historique gratuit.", 403);
  if (row.historyUsedAt) throw new LeaderError("Tu as déjà consulté ton historique gratuit aujourd'hui.", 409);
  const secret = await prisma.secret.findUnique({ where: { id: params.secretId }, select: { formationId: true, status: true, playerId: true } });
  if (!secret || secret.formationId !== params.formationId || secret.status !== "PUBLISHED") {
    throw new LeaderError("Choisis un secret encore en jeu.", 404);
  }
  if (secret.playerId === params.playerId) throw new LeaderError("Choisis le secret de quelqu'un d'autre.");
  const names = await wrongNamesFor(params.secretId);
  // Une seule consultation (conditionnelle) ; le résultat est figé et reste lisible ensuite.
  const done = await prisma.leaderDay.updateMany({
    where: { id: row.id, historyUsedAt: null },
    data: { historyUsedAt: now, historySecretId: params.secretId, historyResult: JSON.stringify(names) },
  });
  if (done.count === 0) throw new LeaderError("Tu as déjà consulté ton historique gratuit aujourd'hui.", 409);
  return names;
}
