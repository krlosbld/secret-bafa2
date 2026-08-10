import { prisma } from "@/lib/prisma";

export async function generateUniqueFormationCode(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const exists = await prisma.formation.findUnique({ where: { code } });
    if (!exists) return code;
  }
  throw new Error("Impossible de générer un code unique");
}
