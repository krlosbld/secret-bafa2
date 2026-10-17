import { prisma } from "@/lib/prisma";
import { getPlayerSession } from "@/lib/playerAuth";
import { getGameState } from "@/lib/gameAccess";
import GameInvitation from "./GameInvitation";

// Invitation au Jeu des secrets : proposée une seule fois à chaque stagiaire de la session, après le
// lancement par le directeur et tant qu'il n'a pas répondu (oui ou non, définitif).
export default async function GameInvitationGate() {
  const session = await getPlayerSession();
  if (!session) return null;
  const player = await prisma.player.findUnique({
    where: { id: session.playerId },
    select: { role: true, active: true, formationId: true, gameParticipation: true },
  });
  if (!player || player.role !== "STAGIAIRE" || !player.active || player.gameParticipation) return null;
  const state = await getGameState(player.formationId);
  if (!state.launched || state.ended) return null;
  return <GameInvitation />;
}
