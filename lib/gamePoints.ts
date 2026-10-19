import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Point d'entrée unique pour modifier les points du Jeu des secrets. Chaque opération :
// - verrouille la ligne du joueur (SELECT … FOR UPDATE) : deux opérations simultanées ne se
//   marchent pas dessus ;
// - écrit le nouveau score ET une ligne du journal (PointTransaction) dans la même transaction ;
// - porte une clé d'idempotence unique : rejouée (double clic, rechargement, traitement relancé),
//   elle ne s'applique pas une seconde fois.
// Ne jamais modifier Player.points directement ailleurs.

export type PointKind =
  | "BUZZ_WIN" // découverte d'un secret (ou d'un faux secret)
  | "NIGHTLY" // +1 par nuit, secret non trouvé
  | "END_BONUS" // fin de partie, secret jamais trouvé
  | "HISTORY_REVEAL" // historique payant
  | "MANUAL_SET" // score corrigé à la main
  | "MANUAL_AWARD" // « +1 point » déclenché à la main
  | "GAME_RESET" // remise à zéro de la partie
  | "POWER_PURCHASE"; // achat d'un pouvoir (fausse identité…)

export type PointOperation = {
  formationId: string;
  playerId: string;
  delta: number;
  kind: PointKind;
  key: string; // clé d'idempotence, unique pour toute l'application
  refType?: string;
  refId?: string;
  actorLabel?: string | null;
  note?: string;
  floorAtZero?: boolean; // débit plafonné au solde (jamais de score négatif)
  requireFunds?: boolean; // débit refusé si le solde ne suffit pas
};

export class InsufficientPointsError extends Error {
  constructor(public needed: number, public available: number) {
    super(`Il te faut au moins ${needed} points.`);
  }
}

export type PointResult = { applied: number; balance: number; duplicate: boolean };

type Tx = Prisma.TransactionClient;

// À appeler à l'intérieur d'une transaction (prisma.$transaction(async (tx) => …)).
export async function applyPoints(tx: Tx, op: PointOperation): Promise<PointResult> {
  const done = await tx.pointTransaction.findUnique({ where: { idempotencyKey: op.key }, select: { delta: true, balanceAfter: true } });
  if (done) return { applied: done.delta, balance: done.balanceAfter, duplicate: true };

  const rows = await tx.$queryRaw<{ points: number; firstName: string }[]>`
    SELECT "points", "firstName" FROM "Player" WHERE "id" = ${op.playerId} FOR UPDATE`;
  if (rows.length === 0) throw new Error(`Joueur introuvable : ${op.playerId}`);
  // Une opération identique a pu se terminer pendant qu'on attendait le verrou : on la reconnaît
  // avant de juger le solde (sinon un double clic recevrait « solde insuffisant » au lieu d'un doublon).
  const doneMeanwhile = await tx.pointTransaction.findUnique({ where: { idempotencyKey: op.key }, select: { delta: true, balanceAfter: true } });
  if (doneMeanwhile) return { applied: doneMeanwhile.delta, balance: doneMeanwhile.balanceAfter, duplicate: true };
  const before = rows[0].points;

  if (op.requireFunds && op.delta < 0 && before < -op.delta) throw new InsufficientPointsError(-op.delta, before);
  const applied = op.floorAtZero && op.delta < 0 ? Math.max(op.delta, -before) : op.delta;
  const after = before + applied;

  // Le journal d'abord : si la clé a été prise entre-temps, la contrainte unique annule tout.
  await tx.pointTransaction.create({
    data: {
      formationId: op.formationId,
      playerId: op.playerId,
      playerLabel: rows[0].firstName,
      delta: applied,
      balanceAfter: after,
      kind: op.kind,
      refType: op.refType,
      refId: op.refId,
      idempotencyKey: op.key,
      actorLabel: op.actorLabel ?? null,
      note: op.note,
    },
  });
  if (applied !== 0) await tx.player.update({ where: { id: op.playerId }, data: { points: after } });
  return { applied, balance: after, duplicate: false };
}

// Opération isolée, dans sa propre transaction. Une exécution concurrente de la même clé
// (contrainte unique) est rendue comme un doublon, pas comme une erreur.
export async function applyPointsOnce(op: PointOperation): Promise<PointResult> {
  try {
    return await prisma.$transaction((tx) => applyPoints(tx, op));
  } catch (e) {
    if (isDuplicateKey(e)) {
      const done = await prisma.pointTransaction.findUnique({ where: { idempotencyKey: op.key } });
      if (done) return { applied: done.delta, balance: done.balanceAfter, duplicate: true };
    }
    throw e;
  }
}

export function isDuplicateKey(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

// Clé de requête fournie par l'interface (une par clic intentionnel) : protège les actions sans
// identifiant naturel (historique payant, +1 manuel) contre le double clic. Sans clé valide, on en
// génère une : l'action reste possible, simplement sans cette protection.
export function requestKey(value: unknown): string {
  return typeof value === "string" && /^[A-Za-z0-9-]{8,64}$/.test(value) ? value : crypto.randomUUID();
}
