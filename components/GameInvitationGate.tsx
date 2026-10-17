import { prisma } from "@/lib/prisma";
import { getPlayerSession } from "@/lib/playerAuth";
import { getGameStatus } from "@/lib/gameAccess";
import GameInvitation from "./GameInvitation";

// Invitation au Jeu des secrets : proposée à chaque stagiaire de la session pendant la phase
// d'inscription, tant qu'il n'a pas répondu (oui ou non, définitif). Plus aucune une fois la partie commencée.
export default async function GameInvitationGate() {
  const session = await getPlayerSession();
  if (!session) return null;
  const player = await prisma.player.findUnique({
    where: { id: session.playerId },
    select: { role: true, active: true, isGameMaster: true, formationId: true, gameParticipation: true },
  });
  // Tout membre sauf le maître du jeu : stagiaires, formateurs, directeur qui a confié le rôle.
  if (!player || player.isGameMaster || !player.active || player.gameParticipation) return null;
  if ((await getGameStatus(player.formationId)) !== "inscriptions_ouvertes") return null;
  return <GameInvitation byDirector={player.role !== "DIRECTEUR"} />;
}
