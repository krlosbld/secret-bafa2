import { prisma } from "@/lib/prisma";

export async function getActiveFormation() {
  const formation = await prisma.formation.findFirst({ where: { active: true } });
  if (!formation) {
    throw new Error("Aucune formation active. Contactez un administrateur.");
  }
  return formation;
}

export async function getActiveFormationId(): Promise<string> {
  return (await getActiveFormation()).id;
}
