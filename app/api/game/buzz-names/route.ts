import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentActivePlayer, getGameStatus } from "@/lib/gameAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Prénoms proposés dans la liste déroulante du buzz : les joueurs de la partie (les mêmes que le
// classement, faux joueurs visibles compris — jamais les prénoms des faux secrets cachés, ni le maître
// du jeu), sauf soi-même et ceux dont le secret a déjà été trouvé (réponse plus possible).
export async function GET() {
  const me = await currentActivePlayer();
  if (!me) return NextResponse.json({ error: "Seuls les participants peuvent buzzer." }, { status: 403 });
  if ((await getGameStatus(me.formationId)) !== "en_cours") return NextResponse.json({ names: [] });

  const rows = await prisma.player.findMany({
    where: {
      formationId: me.formationId,
      isGameMaster: false,
      id: { not: me.id },
      OR: [
        { NOT: { secret: { is: { isDecoy: true } } }, active: true, gameParticipation: "ACCEPTED" },
        { NOT: { secret: { is: { isDecoy: true } } }, secret: { is: { status: "PUBLISHED" } } },
        { fakeVisible: true, secret: { is: { isDecoy: true, status: "PUBLISHED" } } },
      ],
      NOT: { secret: { is: { status: "FOUND" } } },
    },
    select: { firstName: true },
  });
  const names = [...new Set(rows.map((r) => r.firstName))].sort((a, b) => a.localeCompare(b, "fr"));
  return NextResponse.json({ names });
}
