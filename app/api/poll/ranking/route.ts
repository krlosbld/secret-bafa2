import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGameFormation } from "@/lib/gameFormation";
import { gameClosedForCurrentPlayer, getGameStatus } from "@/lib/gameAccess";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const formation = await getGameFormation();
  if (!formation || (await gameClosedForCurrentPlayer())) return NextResponse.json({ players: [] });
  const status = await getGameStatus(formation.id);
  if (status !== "en_cours" && status !== "termine") return NextResponse.json({ players: [] });

  // Participants de la session : stagiaires qui ont accepté de jouer, et membres de l'équipe qui
  // jouent (secret validé) — jamais le maître du jeu. Les prénoms des faux secrets n'y figurent que
  // si le maître du jeu en a fait des « faux joueurs » visibles (fakeVisible) : ils sont alors
  // indiscernables des vrais pendant la partie, et révélés (sans médaille) une fois la partie terminée.
  const rows = await prisma.player.findMany({
    where: {
      formationId: formation.id,
      isGameMaster: false,
      OR: [
        { NOT: { secret: { is: { isDecoy: true } } }, active: true, gameParticipation: "ACCEPTED" },
        { NOT: { secret: { is: { isDecoy: true } } }, secret: { is: { status: { in: ["PUBLISHED", "FOUND"] } } } },
        { fakeVisible: true, secret: { is: { isDecoy: true, status: { in: ["PUBLISHED", "FOUND"] } } } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      points: true,
      secret: { select: { status: true, isDecoy: true } },
    },
    orderBy: [{ points: "desc" }, { firstName: "asc" }],
  });
  // isDecoy ne quitte jamais le serveur pendant la partie.
  const ended = status === "termine";
  const players = rows.map(({ secret, ...p }) => ({
    ...p,
    secret: secret ? { status: secret.status } : null,
    ...(ended && secret?.isDecoy ? { fake: true } : {}),
  }));

  return NextResponse.json({ players });
}
