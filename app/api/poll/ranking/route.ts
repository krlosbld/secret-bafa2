import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGameFormation } from "@/lib/gameFormation";
import { gameClosedForCurrentPlayer } from "@/lib/gameAccess";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const formation = await getGameFormation();
  if (!formation || (await gameClosedForCurrentPlayer())) return NextResponse.json({ players: [] });

  // Participants de la session : stagiaires qui ont accepté de jouer, et membres de l'équipe qui
  // jouent (secret validé) — jamais le maître du jeu ni les prénoms inventés des faux secrets, dont
  // la présence (ou un décompte noms / secrets) trahirait les faux.
  const players = await prisma.player.findMany({
    where: {
      formationId: formation.id,
      isGameMaster: false,
      NOT: { secret: { is: { isDecoy: true } } },
      OR: [
        { role: "STAGIAIRE", active: true, gameParticipation: "ACCEPTED" },
        { secret: { is: { status: { in: ["PUBLISHED", "FOUND"] } } } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      points: true,
      secret: { select: { status: true } },
    },
    orderBy: [{ points: "desc" }, { firstName: "asc" }],
  });

  return NextResponse.json({ players });
}
