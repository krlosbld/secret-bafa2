import { prisma } from "@/lib/prisma";
import { CLAIM_FAKE_GUESS_LABEL, resolveWinningBuzz } from "@/lib/buzzResolution";

// Réclamation « c'est un faux secret » : réponse connue du logiciel (secret.isDecoy), donc tranchée
// immédiatement, sans validation du maître du jeu. Le buzz est enregistré et compte dans le quota.
// Juste : le faux secret est démasqué (points via le journal, une seule fois par secret).
// Les contrôles d'accès, d'horaires et de quota restent dans la route (app/api/buzz).
export async function claimFakeSecret(params: {
  secretId: string;
  playerId: string;
  formationId: string;
  isDecoy: boolean;
  bonus: number;
  authorFirstName: string;
}): Promise<{ correct: boolean; points: number; alreadyFound: boolean; buzzId: string }> {
  const buzz = await prisma.buzz.create({
    data: {
      secretId: params.secretId,
      fromPlayerId: params.playerId,
      guessedName: CLAIM_FAKE_GUESS_LABEL,
      status: params.isDecoy ? "PENDING" : "REJECTED",
      isCorrect: params.isDecoy,
    },
  });
  await prisma.player.update({ where: { id: params.playerId }, data: { buzzCount: { increment: 1 } } });
  if (!params.isDecoy) return { correct: false, points: 0, alreadyFound: false, buzzId: buzz.id };

  const points = await resolveWinningBuzz({
    buzzId: buzz.id,
    secretId: params.secretId,
    fromPlayerId: params.playerId,
    secretBonus: params.bonus,
    secretIsDecoy: true,
    secretPlayerFirstName: params.authorFirstName,
    formationId: params.formationId,
  });
  if (points === 0) {
    // Démasqué par quelqu'un d'autre une fraction de seconde avant : ce buzz ne gagne rien.
    await prisma.buzz.update({ where: { id: buzz.id }, data: { status: "REJECTED" } });
    return { correct: true, points: 0, alreadyFound: true, buzzId: buzz.id };
  }
  return { correct: true, points, alreadyFound: false, buzzId: buzz.id };
}
