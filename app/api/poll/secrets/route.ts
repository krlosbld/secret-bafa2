import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGameFormation } from "@/lib/gameFormation";
import { isSecretCurrentlyVisible } from "@/lib/secretVisibility";
import { historyRevealCost } from "@/lib/buzzResolution";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const formation = await getGameFormation();
  if (!formation) return NextResponse.json({ secrets: [] });

  const allSecrets = await prisma.secret.findMany({
    where: { status: { in: ["PUBLISHED", "FOUND"] }, formationId: formation.id },
    select: {
      id: true,
      content: true,
      status: true,
      bonus: true,
      isDecoy: true,
      limitedVisibility: true,
      limitedVisibilitySince: true,
      limitedVisibilityMinutes: true,
      player: { select: { firstName: true } },
      foundBy: { select: { firstName: true } },
    },
    orderBy: { player: { firstName: "asc" } },
  });
  // isDecoy ne doit jamais atteindre le client — on ne garde que le coût déjà calculé.
  const secrets = allSecrets.filter(isSecretCurrentlyVisible).map(({ isDecoy, ...s }) => ({
    ...s,
    revealCost: historyRevealCost({ bonus: s.bonus, isDecoy }),
  }));

  return NextResponse.json({ secrets });
}
