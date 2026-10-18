import { prisma } from "@/lib/prisma";
import { matchesName } from "@/lib/nameCollision";
import { applyPoints, isDuplicateKey } from "@/lib/gamePoints";

// Chaîne fixe utilisée comme `guessedName` pour une réclamation "faux secret" — pas un vrai prénom,
// à exclure partout où on liste des prénoms devinés (ex. la révélation payante d'historique).
export const CLAIM_FAKE_GUESS_LABEL = "🎭 Pense que c'est un faux secret";

// Points gagnés en trouvant ce secret — un faux secret porte directement, dans `bonus`, le nombre
// total de points choisi par l'admin à sa création, pas le "+2" de base des vrais secrets.
export function secretReward(secret: { bonus: number; isDecoy: boolean }): number {
  return secret.isDecoy ? secret.bonus : 2 + secret.bonus;
}

// Coût pour révéler l'historique d'un secret : la récompense qu'il rapporte moins 1 (pour garder un
// intérêt à le trouver plutôt qu'à juste éliminer des pistes), avec un minimum de 2.
export function historyRevealCost(secret: { bonus: number; isDecoy: boolean }): number {
  return Math.max(2, secretReward(secret) - 1);
}

// Marque un buzz comme le bon, crédite les points, marque le secret trouvé, et nettoie tout ce qui
// ne peut plus être correct nulle part : les autres buzz en attente sur ce même secret, et les buzz
// en attente ailleurs dans la formation qui devinaient ce même prénom.
export async function resolveWinningBuzz(params: {
  buzzId: string;
  secretId: string;
  fromPlayerId: string;
  secretBonus: number;
  secretIsDecoy: boolean;
  secretPlayerFirstName: string;
  formationId: string;
}): Promise<number> {
  // Renvoie les points gagnés, ou 0 si le secret avait déjà été trouvé entre-temps.
  const points = secretReward({ bonus: params.secretBonus, isDecoy: params.secretIsDecoy });

  // Un secret ne se trouve qu'une fois : la bascule en FOUND est conditionnelle, et les points passent
  // par le journal avec une clé propre au secret. Deux validations simultanées n'en donnent qu'une.
  const won = await prisma
    .$transaction(async (tx) => {
      const claimed = await tx.secret.updateMany({
        where: { id: params.secretId, status: { not: "FOUND" } },
        data: { status: "FOUND", foundByPlayerId: params.fromPlayerId },
      });
      if (claimed.count === 0) return false;
      await tx.buzz.update({ where: { id: params.buzzId }, data: { status: "VALIDATED" } });
      await tx.buzz.updateMany({ where: { secretId: params.secretId, id: { not: params.buzzId } }, data: { status: "REJECTED" } });
      await applyPoints(tx, {
        formationId: params.formationId,
        playerId: params.fromPlayerId,
        delta: points,
        kind: "BUZZ_WIN",
        key: `buzz-win:${params.secretId}`,
        refType: "buzz",
        refId: params.buzzId,
        note: params.secretIsDecoy ? "Faux secret démasqué" : `Secret de ${params.secretPlayerFirstName}`,
      });
      return true;
    })
    .catch((e) => {
      if (isDuplicateKey(e)) return false;
      throw e;
    });
  if (!won) return 0;

  // Chaque personne n'a qu'un seul secret : une fois le sien trouvé, tout autre buzz en attente
  // (sur n'importe quel autre secret de la formation) qui devinait son prénom ne peut plus être
  // correct nulle part.
  const otherPending = await prisma.buzz.findMany({
    where: { status: "PENDING", secretId: { not: params.secretId }, secret: { formationId: params.formationId } },
    select: { id: true, guessedName: true },
  });
  const staleIds = otherPending
    .filter((b) => matchesName(params.secretPlayerFirstName, b.guessedName))
    .map((b) => b.id);
  if (staleIds.length > 0) {
    await prisma.buzz.updateMany({ where: { id: { in: staleIds } }, data: { status: "REJECTED" } });
  }

  return points;
}
