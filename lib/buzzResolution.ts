import { prisma } from "@/lib/prisma";
import { matchesName } from "@/lib/nameCollision";

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
  // Un faux secret porte directement, dans `bonus`, le nombre total de points choisi par l'admin à
  // sa création — pas le "+2" de base des vrais secrets.
  const points = params.secretIsDecoy ? params.secretBonus : 2 + params.secretBonus;

  await prisma.$transaction([
    prisma.buzz.update({ where: { id: params.buzzId }, data: { status: "VALIDATED" } }),
    prisma.player.update({ where: { id: params.fromPlayerId }, data: { points: { increment: points } } }),
    prisma.secret.update({
      where: { id: params.secretId },
      data: { status: "FOUND", foundByPlayerId: params.fromPlayerId },
    }),
    prisma.buzz.updateMany({
      where: { secretId: params.secretId, id: { not: params.buzzId } },
      data: { status: "REJECTED" },
    }),
  ]);

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
