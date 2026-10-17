import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getPlayerSession } from "@/lib/playerAuth";

// Jeu des secrets — état et règles d'accès, session par session.
//
// - Le directeur lance le jeu (Config gameLaunchedAt) et désigne UN maître du jeu (Player.isGameMaster)
//   parmi les directeurs et formateurs de la session ; lui seul peut le remplacer ensuite.
// - Le maître du jeu (et le super-admin) administre le jeu : réglages, secrets, buzz, joueurs.
// - Après le lancement, chaque stagiaire choisit d'y participer (Player.gameParticipation) : un refus
//   est définitif pour la session ; seul un stagiaire ACCEPTED a accès au jeu.
// - L'équipe (directeurs, formateurs) garde l'onglet Jeu.
export const GAME_LAUNCHED_KEY = "gameLaunchedAt";
export const GAME_LAUNCHED_BY_KEY = "gameLaunchedBy";

export type GameState = {
  launched: boolean;
  launchedAt: string | null;
  ended: boolean;
  gameMaster: { id: string; firstName: string; role: string } | null;
};

export async function getGameState(formationId: string): Promise<GameState> {
  const [rows, gameMaster] = await Promise.all([
    prisma.config.findMany({ where: { formationId, key: { in: [GAME_LAUNCHED_KEY, "gameEnded"] } } }),
    prisma.player.findFirst({ where: { formationId, isGameMaster: true }, select: { id: true, firstName: true, role: true } }),
  ]);
  const values = new Map(rows.map((r) => [r.key, r.value]));
  const launchedAt = values.get(GAME_LAUNCHED_KEY) ?? null;
  return { launched: !!launchedAt, launchedAt, ended: values.get("gameEnded") === "true", gameMaster };
}

export async function isGameLaunched(formationId: string): Promise<boolean> {
  return !!(await prisma.config.findUnique({ where: { formationId_key: { formationId, key: GAME_LAUNCHED_KEY } } }));
}

type CurrentPlayer = { id: string; role: string; formationId: string; isGameMaster: boolean; gameParticipation: string | null };

async function currentPlayer(): Promise<CurrentPlayer | null> {
  const playerSession = await getPlayerSession();
  if (!playerSession) return null;
  return prisma.player.findUnique({
    where: { id: playerSession.playerId },
    select: { id: true, role: true, formationId: true, isGameMaster: true, gameParticipation: true },
  });
}

// Un stagiaire n'a accès au jeu que s'il est lancé ET qu'il a accepté d'y participer.
export async function traineeHasGameAccess(player: { role: string; formationId: string; gameParticipation: string | null }): Promise<boolean> {
  if (player.role !== "STAGIAIRE") return true;
  return player.gameParticipation === "ACCEPTED" && (await isGameLaunched(player.formationId));
}

// true si la personne connectée est un stagiaire sans accès au jeu de sa session (pas lancé, pas
// encore répondu, ou refus) : ni onglet, ni page, ni API du jeu.
export async function gameClosedForCurrentPlayer(): Promise<boolean> {
  const player = await currentPlayer();
  if (!player) return false;
  return !(await traineeHasGameAccess(player));
}

// Administration du jeu (réglages, secrets, buzz, joueurs) : le maître du jeu de la session, ou le
// super-admin / gestionnaire (formationId null = n'importe quelle session, résolue ensuite).
export type GameMasterAuth = { ok: true; formationId: string | null; label: string } | { ok: false };

export async function getGameMasterAuth(): Promise<GameMasterAuth> {
  if (await getSession()) return { ok: true, formationId: null, label: "Administration" };
  const player = await currentPlayer();
  if (player?.isGameMaster) {
    const p = await prisma.player.findUnique({ where: { id: player.id }, select: { firstName: true } });
    return { ok: true, formationId: player.formationId, label: `${p?.firstName ?? "?"} (maître du jeu)` };
  }
  return { ok: false };
}

// Lancer le jeu et désigner / remplacer le maître du jeu : le directeur de la session (ou le
// super-admin). Ce droit ne donne pas accès aux secrets.
export async function getGameDirectorAuth(): Promise<{ ok: true; formationId: string | null } | { ok: false }> {
  if (await getSession()) return { ok: true, formationId: null };
  const player = await currentPlayer();
  if (player?.role === "DIRECTEUR") return { ok: true, formationId: player.formationId };
  return { ok: false };
}
