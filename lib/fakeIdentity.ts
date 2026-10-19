import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getGameStatus, GAME_STARTED_KEY } from "@/lib/gameAccess";
import { getRuleSettings } from "@/lib/gameRuleSettings";
import { paramConfigKey } from "@/lib/gameRules";
import { applyPoints, InsufficientPointsError } from "@/lib/gamePoints";
import { matchesName } from "@/lib/nameCollision";
import { activeBounty } from "@/lib/bounty";

// Fausse identité 🎭 (règle rule_fakeIdentity, désactivée par défaut). Un joueur dont le secret est
// validé et pas encore trouvé achète 24 h de camouflage en empruntant le prénom d'un autre participant.
// Pendant ces 24 h, sur SON secret uniquement, un buzz proposant son vrai prénom ou le prénom emprunté
// est jugé faux (consommé, sans point). C'est l'heure d'ENVOI du buzz qui compte : un buzz envoyé avant
// l'achat (même validé plus tard) n'est pas touché. Le camouflage n'est jamais révélé aux joueurs.
// Une seule utilisation par joueur et par partie ; débit au journal des points (un seul, même en double clic).
export const FAKE_IDENTITY_RULE = "rule_fakeIdentity";
export const FAKE_IDENTITY_KIND = "FAKE_IDENTITY";
export const FAKE_IDENTITY_HOURS = 24;

export class PowerError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

type Db = Prisma.TransactionClient | typeof prisma;

// Camouflage actif sur le secret de ce joueur à cet instant (null sinon).
export async function activeCamouflage(db: Db, ownerPlayerId: string, at: Date) {
  return db.gamePower.findFirst({
    where: { playerId: ownerPlayerId, kind: FAKE_IDENTITY_KIND, status: "ACTIVE", startsAt: { lte: at }, endsAt: { gt: at } },
    select: { id: true, aliasLabel: true },
  });
}

// Évaluation d'un buzz sur un prénom au moment de son envoi : correct selon les règles ordinaires,
// sauf camouflage actif (vrai prénom ou prénom emprunté → faux, camouflage enregistré sur le buzz).
export async function evaluateNameBuzz(params: { authorPlayerId: string; authorFirstName: string; guessedName: string; at: Date }) {
  const correct = matchesName(params.authorFirstName, params.guessedName);
  const cam = await activeCamouflage(prisma, params.authorPlayerId, params.at);
  if (cam && (correct || (cam.aliasLabel !== null && matchesName(cam.aliasLabel, params.guessedName)))) {
    return { isCorrect: false, camouflagePowerId: cam.id };
  }
  return { isCorrect: correct, camouflagePowerId: null as string | null };
}

// Participants dont on peut emprunter le prénom : joueurs de la partie (mêmes personnes que le
// classement), hors soi-même, maître du jeu et faux joueurs.
async function aliasCandidates(formationId: string, playerId: string) {
  return prisma.player.findMany({
    where: {
      formationId,
      id: { not: playerId },
      isGameMaster: false,
      active: true,
      gameParticipation: "ACCEPTED",
      NOT: { secret: { is: { isDecoy: true } } },
    },
    select: { id: true, firstName: true },
    orderBy: { firstName: "asc" },
  });
}

export type FakeIdentityState = {
  enabled: boolean;
  cost: number;
  hours: number;
  available: boolean;
  reason: string | null;
  active: { aliasLabel: string; endsAt: string } | null; // pour le propriétaire seulement
  used: { aliasLabel: string | null; startsAt: string; endsAt: string; status: string } | null;
  candidates: { id: string; firstName: string }[];
};

export async function getFakeIdentityState(formationId: string, playerId: string, now = new Date()): Promise<FakeIdentityState> {
  const [settings, status, player, power] = await Promise.all([
    getRuleSettings(formationId),
    getGameStatus(formationId),
    prisma.player.findUnique({ where: { id: playerId }, select: { points: true, secret: { select: { status: true, isDecoy: true } } } }),
    prisma.gamePower.findUnique({ where: { formationId_playerId_kind: { formationId, playerId, kind: FAKE_IDENTITY_KIND } } }),
  ]);
  const enabled = settings.enabled[FAKE_IDENTITY_RULE];
  const cost = settings.params[paramConfigKey(FAKE_IDENTITY_RULE, "cost")];
  const isActive = !!power && power.status === "ACTIVE" && power.endsAt > now;
  let reason: string | null = null;
  if (!enabled) reason = "La fausse identité n'est pas activée dans cette partie.";
  else if (status !== "en_cours") reason = "La fausse identité n'est possible que pendant la partie.";
  else if (power) reason = isActive ? "Ta fausse identité est active." : "Tu as déjà utilisé ta fausse identité pour cette partie.";
  else if (await activeBounty(playerId, now)) reason = "Impossible pendant que ton secret est mis à prix (les deux pouvoirs ne se cumulent pas).";
  else if (!player?.secret || player.secret.isDecoy || player.secret.status !== "PUBLISHED") reason = "Il faut un secret validé et pas encore trouvé.";
  else if (player.points < cost) reason = `Il te faut au moins ${cost} points.`;
  const available = reason === null;
  return {
    enabled,
    cost,
    hours: FAKE_IDENTITY_HOURS,
    available,
    reason,
    active: isActive && power ? { aliasLabel: power.aliasLabel ?? "?", endsAt: power.endsAt.toISOString() } : null,
    used: power ? { aliasLabel: power.aliasLabel, startsAt: power.startsAt.toISOString(), endsAt: power.endsAt.toISOString(), status: isActive ? "ACTIVE" : power.status === "ACTIVE" ? "EXPIRED" : power.status } : null,
    candidates: available ? await aliasCandidates(formationId, playerId) : [],
  };
}

export async function buyFakeIdentity(params: { formationId: string; playerId: string; aliasPlayerId: string; now?: Date }) {
  const { formationId, playerId, aliasPlayerId } = params;
  const now = params.now ?? new Date();
  const settings = await getRuleSettings(formationId);
  if (!settings.enabled[FAKE_IDENTITY_RULE]) throw new PowerError("La fausse identité n'est pas activée dans cette partie.", 403);
  if ((await getGameStatus(formationId)) !== "en_cours") throw new PowerError("La fausse identité n'est possible que pendant la partie.", 403);
  const cost = settings.params[paramConfigKey(FAKE_IDENTITY_RULE, "cost")];

  const alias = (await aliasCandidates(formationId, playerId)).find((c) => c.id === aliasPlayerId);
  if (!alias) throw new PowerError("Choisis un participant de la partie (ni toi, ni le maître du jeu).");
  const started = await prisma.config.findUnique({ where: { formationId_key: { formationId, key: GAME_STARTED_KEY } }, select: { value: true } });

  try {
    return await prisma.$transaction(async (tx) => {
      // Verrou sur le joueur : achats simultanés (double clic) traités l'un après l'autre.
      await tx.$queryRaw`SELECT "id" FROM "Player" WHERE "id" = ${playerId} FOR UPDATE`;
      const existing = await tx.gamePower.findUnique({ where: { formationId_playerId_kind: { formationId, playerId, kind: FAKE_IDENTITY_KIND } } });
      if (existing) throw new PowerError("Tu as déjà utilisé ta fausse identité pour cette partie.", 409);
      const bounty = await tx.gamePower.findFirst({ where: { playerId, kind: "BOUNTY", status: "ACTIVE", startsAt: { lte: now }, endsAt: { gt: now } } });
      if (bounty) throw new PowerError("Impossible pendant que ton secret est mis à prix (les deux pouvoirs ne se cumulent pas).", 409);
      const secret = await tx.secret.findUnique({ where: { playerId }, select: { status: true, isDecoy: true } });
      if (!secret || secret.isDecoy || secret.status !== "PUBLISHED") throw new PowerError("Il faut un secret validé et pas encore trouvé.");
      const power = await tx.gamePower.create({
        data: {
          formationId,
          playerId,
          kind: FAKE_IDENTITY_KIND,
          cost,
          aliasPlayerId: alias.id,
          aliasLabel: alias.firstName,
          startsAt: now,
          endsAt: new Date(now.getTime() + FAKE_IDENTITY_HOURS * 3600_000),
        },
      });
      await applyPoints(tx, {
        formationId,
        playerId,
        delta: -cost,
        kind: "POWER_PURCHASE",
        key: `power:${FAKE_IDENTITY_KIND}:${formationId}:${started?.value ?? "partie"}:${playerId}`,
        refType: "power",
        refId: power.id,
        requireFunds: true,
        note: "Fausse identité (24 h)",
      });
      return power;
    });
  } catch (e) {
    if (e instanceof InsufficientPointsError) throw new PowerError(`Il te faut au moins ${cost} points.`, 409);
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new PowerError("Tu as déjà utilisé ta fausse identité pour cette partie.", 409);
    }
    throw e;
  }
}

// Fin naturelle (24 h écoulées) : statut d'affichage. L'effet, lui, dépend déjà de endsAt.
export async function expirePowers(formationId?: string, now = new Date()) {
  const done = await prisma.gamePower.updateMany({
    where: { ...(formationId ? { formationId } : {}), kind: FAKE_IDENTITY_KIND, status: "ACTIVE", endsAt: { lte: now } },
    data: { status: "EXPIRED", endedAt: now, endReason: "24 h écoulées" },
  });
  return done.count;
}

// Secret trouvé (bonne réponse envoyée avant l'achat puis validée) : le camouflage n'a plus d'objet.
export async function endCamouflageOnFound(tx: Prisma.TransactionClient, ownerPlayerId: string) {
  await tx.gamePower.updateMany({
    where: { playerId: ownerPlayerId, kind: FAKE_IDENTITY_KIND, status: "ACTIVE" },
    data: { status: "ENDED", endedAt: new Date(), endReason: "Secret trouvé" },
  });
}

// Fin de partie : plus aucun pouvoir actif (les mises à prix sont réglées juste avant, voir lib/bounty).
export async function endPowersAtGameEnd(tx: Prisma.TransactionClient, formationId: string) {
  await tx.gamePower.updateMany({
    where: { formationId, status: "ACTIVE" },
    data: { status: "ENDED", endedAt: new Date(), endReason: "Fin de partie" },
  });
}
