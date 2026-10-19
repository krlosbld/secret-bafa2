import { prisma } from "@/lib/prisma";
import { getGameStatus } from "@/lib/gameAccess";
import { generateUniquePlayerCode } from "@/lib/playerCode";
import { findNameCollision } from "@/lib/nameCollision";
import { randomDecoy } from "@/lib/decoySecrets";
import { FAKE_IDENTITY_KIND } from "@/lib/fakeIdentity";
import { BOUNTY_KIND, settleBountyHits } from "@/lib/bounty";

// Transformer un vrai secret en faux secret (choix stratégique du maître du jeu). Le secret passe sur
// une nouvelle fiche de faux secret (prénom inventé, caché tant que le maître du jeu n'en fait pas un
// « faux joueur » visible) : à partir de là, seule la réclamation « faux secret » est juste. Les buzz
// déjà tranchés restent tels quels. Les buzz EN ATTENTE sur ce secret — y compris une bonne réponse —
// deviennent faux et sont clos au moment de la transformation (c'est le but : annuler une découverte
// en cours) ; ils restent décomptés du quota, sans point. L'ancien auteur reste joueur avec ses points, ne peut pas buzzer
// sur son ancien secret (il en connaît le texte) et propose un nouveau secret, même partie commencée.
export class ConversionError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

async function freeDecoyName(formationId: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const { firstName } = randomDecoy();
    if (!(await findNameCollision(formationId, firstName, undefined, { ignoreGameMaster: true }))) return firstName;
  }
  return `${randomDecoy().firstName} ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}.`;
}

export async function convertSecretToDecoy(params: {
  formationId: string;
  secretId: string;
  now?: Date;
}): Promise<{ authorFirstName: string; decoyFirstName: string; closedBuzzes: number }> {
  const now = params.now ?? new Date();
  const status = await getGameStatus(params.formationId);
  if (status !== "inscriptions_ouvertes" && status !== "en_cours") throw new ConversionError("Possible seulement pendant les inscriptions ou la partie.", 409);
  const secret = await prisma.secret.findUnique({
    where: { id: params.secretId },
    select: { id: true, formationId: true, status: true, isDecoy: true, playerId: true, player: { select: { firstName: true } } },
  });
  if (!secret || secret.formationId !== params.formationId) throw new ConversionError("Secret introuvable.", 404);
  if (secret.isDecoy) throw new ConversionError("C'est déjà un faux secret.", 409);
  if (secret.status !== "PUBLISHED") throw new ConversionError("Seul un secret validé et pas encore trouvé peut être transformé.", 409);
  const power = await prisma.gamePower.findFirst({
    where: {
      playerId: secret.playerId,
      OR: [
        { kind: FAKE_IDENTITY_KIND, status: "ACTIVE", endsAt: { gt: now } },
        { kind: BOUNTY_KIND, stakeSettledAt: null },
      ],
    },
    select: { kind: true },
  });
  if (power) {
    throw new ConversionError(
      power.kind === BOUNTY_KIND
        ? `${secret.player.firstName} a une mise à prix en cours sur ce secret : attends qu'elle soit réglée.`
        : `${secret.player.firstName} a une fausse identité active sur ce secret : attends qu'elle se termine.`,
      409
    );
  }

  const decoyFirstName = await freeDecoyName(params.formationId);
  const code = await generateUniquePlayerCode(params.formationId);
  const closed = await prisma.$transaction(async (tx) => {
    const fake = await tx.player.create({ data: { formationId: params.formationId, firstName: decoyFirstName, code, role: "STAGIAIRE", active: false } });
    // Conditionnel : un buzz validé ou une autre transformation entre-temps l'emporte.
    const done = await tx.secret.updateMany({
      where: { id: secret.id, playerId: secret.playerId, status: "PUBLISHED", isDecoy: false },
      data: { playerId: fake.id, isDecoy: true, convertedFromPlayerId: secret.playerId, convertedAt: now, limitedVisibility: false, limitedVisibilitySince: null },
    });
    if (done.count === 0) throw new ConversionError("Ce secret vient de changer (trouvé ou déjà transformé) : recharge la page.", 409);
    // Buzz en attente sur ce secret (même ceux arrivés à l'instant) : la réponse attendue n'est plus un
    // prénom, ils deviennent faux et sont clos.
    const pending = await tx.buzz.findMany({ where: { secretId: secret.id, status: "PENDING" }, select: { id: true } });
    if (pending.length > 0) {
      await tx.buzz.updateMany({ where: { id: { in: pending.map((b) => b.id) } }, data: { status: "REJECTED", isCorrect: false } });
    }
    return pending.map((b) => b.id);
  });
  // Résultat définitif pour ces buzz : transferts éventuels d'une mise à prix (prénom proposé à tort).
  await settleBountyHits(closed);
  return { authorFirstName: secret.player.firstName, decoyFirstName, closedBuzzes: closed.length };
}

// Le joueur doit-il proposer un nouveau secret parce que le sien a été transformé en faux ?
export async function mustReplaceSecret(playerId: string): Promise<boolean> {
  const [own, converted] = await Promise.all([
    prisma.secret.findUnique({ where: { playerId }, select: { status: true } }),
    prisma.secret.count({ where: { convertedFromPlayerId: playerId } }),
  ]);
  return converted > 0 && (!own || own.status === "REJECTED");
}

// Points de nuit (et +1 manuel) : l'auteur d'un secret transformé continue de gagner son point chaque
// nuit pendant qu'il attend la validation de son nouveau secret (seul son secret change). Une fois le
// nouveau secret validé, il est compté comme tout auteur ; s'il est trouvé, plus de point.
export async function authorsAwaitingNewSecret(formationId: string): Promise<string[]> {
  const rows = await prisma.player.findMany({
    where: {
      formationId,
      active: true,
      gameParticipation: "ACCEPTED",
      convertedSecrets: { some: {} },
      OR: [{ secret: { is: null } }, { secret: { is: { status: { in: ["PENDING", "REJECTED"] } } } }],
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
