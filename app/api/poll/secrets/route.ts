import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGameFormation } from "@/lib/gameFormation";
import { gameClosedForCurrentPlayer, getGameStatus } from "@/lib/gameAccess";
import { isSecretCurrentlyVisible } from "@/lib/secretVisibility";
import { historyRevealCost } from "@/lib/buzzResolution";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const formation = await getGameFormation();
  if (!formation || (await gameClosedForCurrentPlayer())) return NextResponse.json({ secrets: [] });
  // Pendant les inscriptions, aucun secret n'est visible ; à la fin, les auteurs sont révélés.
  const status = await getGameStatus(formation.id);
  if (status !== "en_cours" && status !== "termine") return NextResponse.json({ secrets: [] });

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
    orderBy: { createdAt: "asc" },
  });
  // isDecoy ne doit jamais atteindre le client — on ne garde que le coût déjà calculé.
  // L'auteur n'est envoyé qu'une fois le secret trouvé : sinon n'importe quel joueur le lirait dans
  // les données reçues par son navigateur.
  const secrets = allSecrets.filter(isSecretCurrentlyVisible).map(({ isDecoy, player, ...s }) => ({
    ...s,
    player: s.status === "FOUND" || status === "termine" ? (isDecoy ? { firstName: "🎭 faux secret" } : player) : null,
    revealCost: historyRevealCost({ bonus: s.bonus, isDecoy }),
  }));

  return NextResponse.json({ secrets });
}
