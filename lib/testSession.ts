import { prisma } from "@/lib/prisma";

// « Session test » (Config testSession = "true") : une session gardée ouverte en permanence pour
// vérifier le site avec de vraies données. Elle n'est jamais archivée, et l'accueil du stagiaire y
// rejoue chaque jour une journée de son planning (J1, J2… puis on recommence).
export const TEST_SESSION_KEY = "testSession";

export async function testSessionIds(formationIds: string[]): Promise<Set<string>> {
  if (formationIds.length === 0) return new Set();
  const rows = await prisma.config.findMany({
    where: { formationId: { in: formationIds }, key: TEST_SESSION_KEY, value: "true" },
    select: { formationId: true },
  });
  return new Set(rows.map((r) => r.formationId));
}
