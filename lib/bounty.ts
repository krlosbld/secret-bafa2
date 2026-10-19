import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getGameStatus, GAME_STARTED_KEY } from "@/lib/gameAccess";
import { getRuleSettings } from "@/lib/gameRuleSettings";
import { paramConfigKey } from "@/lib/gameRules";
import { applyPoints, InsufficientPointsError, isDuplicateKey } from "@/lib/gamePoints";
import { matchesName } from "@/lib/nameCollision";
import { CLAIM_FAKE_GUESS_LABEL } from "@/lib/buzzResolution";
import { FAKE_IDENTITY_KIND, PowerError } from "@/lib/fakeIdentity";

// Secret mis à prix 🎯 (règle rule_bounty, désactivée par défaut). Règles validées :
// - le joueur (secret validé, pas encore trouvé) engage une mise de 1 à « mise maximale » points :
//   elle est retirée de son score et mise en réserve pendant 24 h ; une fois par partie ; impossible
//   pendant une fausse identité active (et inversement) ;
// - pendant les 24 h (heure d'ENVOI du buzz), un adversaire qui propose à tort son prénom lui verse la
//   mise, une seule fois par adversaire, plafonnée au solde de l'adversaire (jamais de score négatif) ;
//   le transfert n'a lieu qu'une fois le résultat du buzz DÉFINITIF (rejeté / clos par le maître du jeu) ;
// - la mise réservée est réglée UNE seule fois : si le secret est trouvé par un buzz envoyé pendant les
//   24 h, elle va à celui qui l'a trouvé (en plus des points habituels) et le pouvoir prend fin ; sinon
//   elle est rendue au propriétaire — mais pas tant qu'une bonne réponse envoyée pendant les 24 h attend
//   la validation ; à la fin de la partie, toute mise non réglée est rendue et plus aucun transfert n'a lieu.
// Toutes les opérations passent par le journal des points (clés uniques : aucun double débit / crédit).
export const BOUNTY_RULE = "rule_bounty";
export const BOUNTY_KIND = "BOUNTY";
export const BOUNTY_HOURS = 24;

type Tx = Prisma.TransactionClient;
type PowerRow = { id: string; formationId: string; playerId: string; cost: number; startsAt: Date; endsAt: Date; endedAt: Date | null; status: string };

// Fin effective de la fenêtre : 24 h, ou plus tôt si le secret a été trouvé.
const windowEnd = (p: { endsAt: Date; endedAt: Date | null; status: string }) => (p.status === "ENDED" && p.endedAt && p.endedAt < p.endsAt ? p.endedAt : p.endsAt);
const inWindow = (p: PowerRow, at: Date) => at >= p.startsAt && at < windowEnd(p);

// ── Activation ──────────────────────────────────────────────────────────────────────────────────

export async function activateBounty(params: { formationId: string; playerId: string; stake: number; now?: Date }) {
  const { formationId, playerId } = params;
  const now = params.now ?? new Date();
  const settings = await getRuleSettings(formationId);
  if (!settings.enabled[BOUNTY_RULE]) throw new PowerError("Le secret mis à prix n'est pas activé dans cette partie.", 403);
  if ((await getGameStatus(formationId)) !== "en_cours") throw new PowerError("Le secret mis à prix n'est possible que pendant la partie.", 403);
  const maxStake = settings.params[paramConfigKey(BOUNTY_RULE, "maxStake")];
  const stake = Number(params.stake);
  if (!Number.isInteger(stake) || stake < 1 || stake > maxStake) throw new PowerError(`Choisis une mise entre 1 et ${maxStake} points.`);
  const started = await prisma.config.findUnique({ where: { formationId_key: { formationId, key: GAME_STARTED_KEY } }, select: { value: true } });

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Player" WHERE "id" = ${playerId} FOR UPDATE`;
      if (await tx.gamePower.findUnique({ where: { formationId_playerId_kind: { formationId, playerId, kind: BOUNTY_KIND } } })) {
        throw new PowerError("Tu as déjà mis ton secret à prix pendant cette partie.", 409);
      }
      const camouflage = await tx.gamePower.findFirst({
        where: { playerId, kind: FAKE_IDENTITY_KIND, status: "ACTIVE", startsAt: { lte: now }, endsAt: { gt: now } },
      });
      if (camouflage) throw new PowerError("Impossible pendant ta fausse identité : les deux pouvoirs ne se cumulent pas.", 409);
      const secret = await tx.secret.findUnique({ where: { playerId }, select: { status: true, isDecoy: true } });
      if (!secret || secret.isDecoy || secret.status !== "PUBLISHED") throw new PowerError("Il faut un secret validé et pas encore trouvé.");
      const power = await tx.gamePower.create({
        data: { formationId, playerId, kind: BOUNTY_KIND, cost: stake, startsAt: now, endsAt: new Date(now.getTime() + BOUNTY_HOURS * 3600_000) },
      });
      await applyPoints(tx, {
        formationId,
        playerId,
        delta: -stake,
        kind: "BOUNTY_STAKE",
        key: `power:${BOUNTY_KIND}:${formationId}:${started?.value ?? "partie"}:${playerId}`,
        refType: "power",
        refId: power.id,
        requireFunds: true,
        note: `Mise de ${stake} point(s) mise en réserve (24 h)`,
      });
      return power;
    });
  } catch (e) {
    if (e instanceof InsufficientPointsError) throw new PowerError(`Il te faut au moins ${stake} points pour cette mise.`, 409);
    if (isDuplicateKey(e)) throw new PowerError("Tu as déjà mis ton secret à prix pendant cette partie.", 409);
    throw e;
  }
}

// Mise à prix en cours (fenêtre ouverte) pour ce joueur — sert aussi à l'incompatibilité avec la fausse identité.
export async function activeBounty(playerId: string, at: Date) {
  return prisma.gamePower.findFirst({ where: { playerId, kind: BOUNTY_KIND, status: "ACTIVE", startsAt: { lte: at }, endsAt: { gt: at } } });
}

// ── Règlement de la mise (une seule fois) ───────────────────────────────────────────────────────

async function settleStake(tx: Tx, power: PowerRow, outcome: { won: false } | { won: true; winnerId: string; winnerName: string }, status: string, endReason: string) {
  const now = new Date();
  const claimed = await tx.gamePower.updateMany({
    where: { id: power.id, stakeSettledAt: null },
    data: {
      stakeSettledAt: now,
      stakeOutcome: outcome.won ? "WON" : "REFUNDED",
      stakeWinnerId: outcome.won ? outcome.winnerId : null,
      status,
      endedAt: now,
      endReason,
    },
  });
  if (claimed.count === 0) return; // déjà réglée
  await applyPoints(tx, {
    formationId: power.formationId,
    playerId: outcome.won ? outcome.winnerId : power.playerId,
    delta: power.cost,
    kind: outcome.won ? "BOUNTY_WON" : "BOUNTY_REFUND",
    key: `bounty-stake:${power.id}`, // même clé pour les deux issues : une seule peut s'appliquer
    refType: "power",
    refId: power.id,
    note: outcome.won ? "Mise gagnée en trouvant un secret mis à prix" : "Mise rendue",
  });
}

// Secret trouvé (dans la transaction de resolveWinningBuzz) : mise au gagnant si sa bonne réponse a
// été envoyée pendant la mise à prix, sinon rendue. Le pouvoir prend fin.
export async function onSecretFound(tx: Tx, params: { ownerPlayerId: string; winnerPlayerId: string; winningBuzzAt: Date }) {
  const power = await tx.gamePower.findFirst({ where: { playerId: params.ownerPlayerId, kind: BOUNTY_KIND, stakeSettledAt: null } });
  if (!power) return;
  if (inWindow(power, params.winningBuzzAt)) {
    const winner = await tx.player.findUnique({ where: { id: params.winnerPlayerId }, select: { firstName: true } });
    await settleStake(tx, power, { won: true, winnerId: params.winnerPlayerId, winnerName: winner?.firstName ?? "?" }, "ENDED", `Secret trouvé par ${winner?.firstName ?? "?"} : mise gagnée`);
  } else {
    await settleStake(tx, power, { won: false }, "ENDED", "Secret trouvé (réponse envoyée hors de la mise à prix) : mise rendue");
  }
}

// 24 h écoulées : mise rendue, sauf si une bonne réponse envoyée pendant les 24 h attend encore la
// validation (on attend son issue). Appelé par le traitement des 15 min et à l'affichage.
export async function settleExpiredBounties(formationId?: string, now = new Date()) {
  const due = await prisma.gamePower.findMany({
    where: { ...(formationId ? { formationId } : {}), kind: BOUNTY_KIND, stakeSettledAt: null, endsAt: { lte: now } },
  });
  let settled = 0;
  for (const power of due) {
    if ((await getGameStatus(power.formationId)) === "termine") continue; // réglée à la clôture
    const secret = await prisma.secret.findUnique({ where: { playerId: power.playerId }, select: { id: true } });
    const pendingCorrect = secret
      ? await prisma.buzz.count({ where: { secretId: secret.id, status: "PENDING", isCorrect: true, createdAt: { gte: power.startsAt, lt: power.endsAt } } })
      : 0;
    if (pendingCorrect > 0) continue;
    await prisma.$transaction((tx) => settleStake(tx, power, { won: false }, "EXPIRED", "24 h écoulées : mise rendue"));
    settled++;
  }
  return settled;
}

// Clôture de la partie (dans la transaction de fin) : toute mise non réglée est rendue.
export async function settleBountiesAtGameEnd(tx: Tx, formationId: string) {
  const open = await tx.gamePower.findMany({ where: { formationId, kind: BOUNTY_KIND, stakeSettledAt: null } });
  for (const power of open) await settleStake(tx, power, { won: false }, "ENDED", "Fin de partie : mise rendue");
}

// ── Transferts ──────────────────────────────────────────────────────────────────────────────────

// À appeler après qu'un ou plusieurs buzz sont devenus DÉFINITIFS (rejetés, clos). Pour chaque buzz
// faux proposant le prénom d'un joueur dont le secret était mis à prix à l'heure d'envoi du buzz :
// transfert de la mise (plafonnée au solde) de l'auteur du buzz vers le propriétaire, une fois par
// adversaire. Idempotent : rappelé deux fois, il ne transfère rien de plus.
export async function settleBountyHits(buzzIds: string[]) {
  if (buzzIds.length === 0) return 0;
  const buzzes = await prisma.buzz.findMany({
    where: { id: { in: buzzIds }, status: { in: ["REJECTED", "VALIDATED"] }, isCorrect: false, guessedName: { not: CLAIM_FAKE_GUESS_LABEL } },
    include: { secret: { select: { formationId: true, playerId: true } } },
  });
  let done = 0;
  for (const b of buzzes) {
    const formationId = b.secret.formationId;
    if ((await getGameStatus(formationId)) === "termine") continue; // plus aucun transfert après la clôture
    const powers = await prisma.gamePower.findMany({
      where: { formationId, kind: BOUNTY_KIND, playerId: { not: b.fromPlayerId }, startsAt: { lte: b.createdAt }, endsAt: { gt: b.createdAt } },
      include: { player: { select: { firstName: true } } },
    });
    for (const power of powers) {
      if (!inWindow(power, b.createdAt)) continue;
      if (b.secret.playerId === power.playerId) continue; // son propre secret : ce n'est pas une erreur sur son prénom
      if (!matchesName(power.player.firstName, b.guessedName)) continue;
      try {
        await prisma.$transaction(async (tx) => {
          if (await tx.bountyHit.findUnique({ where: { powerId_fromPlayerId: { powerId: power.id, fromPlayerId: b.fromPlayerId } } })) return;
          const debit = await applyPoints(tx, {
            formationId,
            playerId: b.fromPlayerId,
            delta: -power.cost,
            kind: "BOUNTY_PENALTY",
            key: `bounty-hit:${power.id}:${b.fromPlayerId}`,
            refType: "buzz",
            refId: b.id,
            floorAtZero: true,
            note: "Prénom d'un secret mis à prix proposé à tort",
          });
          const amount = -debit.applied;
          if (amount > 0) {
            await applyPoints(tx, {
              formationId,
              playerId: power.playerId,
              delta: amount,
              kind: "BOUNTY_GAIN",
              key: `bounty-gain:${power.id}:${b.fromPlayerId}`,
              refType: "buzz",
              refId: b.id,
              note: "Mise versée par un adversaire qui s'est trompé",
            });
          }
          await tx.bountyHit.create({ data: { powerId: power.id, fromPlayerId: b.fromPlayerId, buzzId: b.id, amount } });
          done++;
        });
      } catch (e) {
        if (!isDuplicateKey(e)) throw e; // transfert déjà fait (exécution concurrente)
      }
    }
  }
  return done;
}

// ── Affichage (joueur) ──────────────────────────────────────────────────────────────────────────

export type BountyState = {
  enabled: boolean;
  maxStake: number;
  hours: number;
  available: boolean;
  reason: string | null;
  points: number;
  active: { stake: number; endsAt: string; awaiting: boolean; hits: number; gained: number } | null;
  used: { stake: number; startsAt: string; endsAt: string; outcome: string | null; endReason: string | null; hits: number; gained: number } | null;
};

export async function getBountyState(formationId: string, playerId: string, now = new Date()): Promise<BountyState> {
  await settleExpiredBounties(formationId, now);
  const [settings, status, player, power, camouflage] = await Promise.all([
    getRuleSettings(formationId),
    getGameStatus(formationId),
    prisma.player.findUnique({ where: { id: playerId }, select: { points: true, secret: { select: { status: true, isDecoy: true } } } }),
    prisma.gamePower.findUnique({ where: { formationId_playerId_kind: { formationId, playerId, kind: BOUNTY_KIND } }, include: { bountyHits: { select: { amount: true } } } }),
    prisma.gamePower.findFirst({ where: { playerId, kind: FAKE_IDENTITY_KIND, status: "ACTIVE", startsAt: { lte: now }, endsAt: { gt: now } } }),
  ]);
  const enabled = settings.enabled[BOUNTY_RULE];
  const maxStake = settings.params[paramConfigKey(BOUNTY_RULE, "maxStake")];
  const points = player?.points ?? 0;
  let reason: string | null = null;
  if (!enabled) reason = "Le secret mis à prix n'est pas activé dans cette partie.";
  else if (status !== "en_cours") reason = "Le secret mis à prix n'est possible que pendant la partie.";
  else if (power) reason = power.stakeSettledAt ? "Tu as déjà mis ton secret à prix pendant cette partie." : "Ton secret est mis à prix.";
  else if (camouflage) reason = "Impossible pendant ta fausse identité (les deux pouvoirs ne se cumulent pas).";
  else if (!player?.secret || player.secret.isDecoy || player.secret.status !== "PUBLISHED") reason = "Il faut un secret validé et pas encore trouvé.";
  else if (points < 1) reason = "Il te faut au moins 1 point.";
  const hits = power?.bountyHits.length ?? 0;
  const gained = power?.bountyHits.reduce((a, h) => a + h.amount, 0) ?? 0;
  return {
    enabled,
    maxStake,
    hours: BOUNTY_HOURS,
    available: reason === null,
    reason,
    points,
    active:
      power && !power.stakeSettledAt
        ? { stake: power.cost, endsAt: power.endsAt.toISOString(), awaiting: power.endsAt <= now, hits, gained }
        : null,
    used: power
      ? { stake: power.cost, startsAt: power.startsAt.toISOString(), endsAt: power.endsAt.toISOString(), outcome: power.stakeOutcome, endReason: power.endReason, hits, gained }
      : null,
  };
}
