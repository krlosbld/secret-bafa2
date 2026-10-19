import { prisma } from "@/lib/prisma";
import { CLAIM_FAKE_GUESS_LABEL } from "@/lib/buzzResolution";

// Prénoms déjà proposés à tort sur un secret (historique payant, historique gratuit du leader).
// Jamais qui les a proposés. Les réponses jugées fausses par une fausse identité en font partie
// (décision : ne jamais révéler le camouflage, même après coup).
export async function wrongNamesFor(secretId: string): Promise<string[]> {
  const wrong = await prisma.buzz.findMany({
    where: { secretId, isCorrect: false, guessedName: { not: CLAIM_FAKE_GUESS_LABEL } },
    select: { guessedName: true },
  });
  return [...new Set(wrong.map((b) => b.guessedName))];
}
