import { prisma } from "@/lib/prisma";
import { getPlayerSession } from "@/lib/playerAuth";

// Jeu Secret BAFA ouvert ou non aux stagiaires, session par session (Config gameOpenToTrainees).
// Fermé par défaut : l'onglet Jeu est caché aux stagiaires et le jeu leur est refusé côté serveur.
// Le directeur l'ouvre depuis Jeu → Gestion du jeu. L'équipe garde toujours accès au jeu.
export const TRAINEE_GAME_KEY = "gameOpenToTrainees";

export async function isGameOpenToTrainees(formationId: string): Promise<boolean> {
  const row = await prisma.config.findUnique({ where: { formationId_key: { formationId, key: TRAINEE_GAME_KEY } } });
  return row?.value === "true";
}

// true si la personne connectée est stagiaire dans la session ouverte et que le jeu y est fermé.
export async function gameClosedForCurrentPlayer(): Promise<boolean> {
  const playerSession = await getPlayerSession();
  if (!playerSession) return false;
  const player = await prisma.player.findUnique({ where: { id: playerSession.playerId }, select: { role: true, formationId: true } });
  if (player?.role !== "STAGIAIRE") return false;
  return !(await isGameOpenToTrainees(player.formationId));
}
