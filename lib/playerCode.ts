import { prisma } from "@/lib/prisma";

export async function generateUniquePlayerCode(formationId: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const exists = await prisma.player.findUnique({ where: { formationId_code: { formationId, code } } });
    if (!exists) return code;
  }
  throw new Error("Impossible de générer un code unique");
}
