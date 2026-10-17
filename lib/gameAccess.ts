import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getPlayerSession } from "@/lib/playerAuth";

// Jeu des secrets — états et règles d'accès, session par session.
//
// États de la partie (dérivés des réglages de la session, voir getGameState) :
//   non_configure          → rien n'est possible ;
//   inscriptions_ouvertes  → invitations, propositions et validation des secrets (lancé par le directeur) ;
//   en_cours               → inscriptions fermées, secrets validés visibles, buzz (démarré par le maître du jeu) ;
//   termine                → résultats définitifs, classement et auteurs consultables.
//
// Participants (Player.gameParticipation) : null = invité, ACCEPTED, DECLINED, EXCLUDED, EXPIRED.
// Seuls les stagiaires qui ont accepté jouent. Un participant qui n'a envoyé aucune proposition dans
// les 24 h suivant son acceptation perd sa participation (EXPIRED) ; c'est vérifié à chaque accès au
// jeu et par un traitement serveur régulier (/api/cron/game-expiry).
//
// Le directeur lance les inscriptions et désigne / remplace l'unique maître du jeu
// (Player.isGameMaster), qui administre le jeu. L'équipe peut consulter le jeu mais ne joue pas.
export const GAME_LAUNCHED_KEY = "gameLaunchedAt";
export const GAME_LAUNCHED_BY_KEY = "gameLaunchedBy";
export const GAME_STARTED_KEY = "gameStartedAt";
export const PROPOSAL_DELAY_MS = 24 * 60 * 60 * 1000;

export type GameStatus = "non_configure" | "inscriptions_ouvertes" | "en_cours" | "termine";

export type GameState = {
  status: GameStatus;
  launched: boolean; // inscriptions ouvertes ou au-delà
  launchedAt: string | null;
  startedAt: string | null;
  ended: boolean;
  gameMaster: { id: string; firstName: string; role: string } | null;
};

function statusFrom(values: Map<string, string>): GameStatus {
  // « gameEnded » est antérieur aux phases : une partie terminée l'est quel que soit le reste.
  if (values.get("gameEnded") === "true") return "termine";
  if (values.get(GAME_STARTED_KEY)) return "en_cours";
  if (values.get(GAME_LAUNCHED_KEY)) return "inscriptions_ouvertes";
  return "non_configure";
}

export async function getGameState(formationId: string): Promise<GameState> {
  const [rows, gameMaster] = await Promise.all([
    prisma.config.findMany({ where: { formationId, key: { in: [GAME_LAUNCHED_KEY, GAME_STARTED_KEY, "gameEnded"] } } }),
    prisma.player.findFirst({ where: { formationId, isGameMaster: true }, select: { id: true, firstName: true, role: true } }),
  ]);
  const values = new Map(rows.map((r) => [r.key, r.value]));
  const status = statusFrom(values);
  return {
    status,
    launched: status !== "non_configure",
    launchedAt: values.get(GAME_LAUNCHED_KEY) ?? null,
    startedAt: values.get(GAME_STARTED_KEY) ?? null,
    ended: status === "termine",
    gameMaster,
  };
}

export async function getGameStatus(formationId: string): Promise<GameStatus> {
  const rows = await prisma.config.findMany({ where: { formationId, key: { in: [GAME_LAUNCHED_KEY, GAME_STARTED_KEY, "gameEnded"] } } });
  return statusFrom(new Map(rows.map((r) => [r.key, r.value])));
}

export async function isGameLaunched(formationId: string): Promise<boolean> {
  return (await getGameStatus(formationId)) !== "non_configure";
}

// Expire les participants acceptés sans aucune proposition depuis plus de 24 h (une session, ou
// toutes). Conditionnel : n'écrase jamais un autre état ni un participant qui a proposé un secret.
export async function expireOverdueParticipants(formationId?: string): Promise<number> {
  const done = await prisma.player.updateMany({
    where: {
      ...(formationId ? { formationId } : {}),
      role: "STAGIAIRE",
      gameParticipation: "ACCEPTED",
      gameParticipationAt: { lt: new Date(Date.now() - PROPOSAL_DELAY_MS) },
      secret: { is: null },
    },
    data: { gameParticipation: "EXPIRED", gameExitAt: new Date(), gameExitBy: "Expiration automatique (aucun secret en 24 h)" },
  });
  return done.count;
}

type GamePlayer = { id: string; role: string; formationId: string; isGameMaster: boolean; gameParticipation: string | null };

// Participation réelle d'un stagiaire, délai de 24 h compris (appliqué et enregistré au passage).
export async function effectiveParticipation(player: { id: string; role: string; gameParticipation: string | null }): Promise<string | null> {
  if (player.role !== "STAGIAIRE" || player.gameParticipation !== "ACCEPTED") return player.gameParticipation;
  const row = await prisma.player.findUnique({ where: { id: player.id }, select: { gameParticipationAt: true, secret: { select: { id: true } } } });
  const overdue = !row?.secret && !!row?.gameParticipationAt && row.gameParticipationAt.getTime() < Date.now() - PROPOSAL_DELAY_MS;
  if (!overdue) return "ACCEPTED";
  await prisma.player.updateMany({
    where: { id: player.id, gameParticipation: "ACCEPTED", secret: { is: null } },
    data: { gameParticipation: "EXPIRED", gameExitAt: new Date(), gameExitBy: "Expiration automatique (aucun secret en 24 h)" },
  });
  return "EXPIRED";
}

async function currentPlayer(): Promise<GamePlayer | null> {
  const playerSession = await getPlayerSession();
  if (!playerSession) return null;
  return prisma.player.findUnique({
    where: { id: playerSession.playerId },
    select: { id: true, role: true, formationId: true, isGameMaster: true, gameParticipation: true },
  });
}

// Un stagiaire n'a accès au jeu que s'il est participant (accepté, dans les délais) d'une partie
// lancée. L'équipe y a toujours accès (consultation ; administration pour le maître du jeu).
export async function traineeHasGameAccess(player: { id: string; role: string; formationId: string; gameParticipation: string | null }): Promise<boolean> {
  if (player.role !== "STAGIAIRE") return true;
  if (!(await isGameLaunched(player.formationId))) return false;
  return (await effectiveParticipation(player)) === "ACCEPTED";
}

// true si la personne connectée est un stagiaire sans accès au jeu de sa session.
export async function gameClosedForCurrentPlayer(): Promise<boolean> {
  const player = await currentPlayer();
  if (!player) return false;
  return !(await traineeHasGameAccess(player));
}

// Joueur actif de la partie : stagiaire participant (accepté, dans les délais). L'équipe et le
// maître du jeu ne jouent pas.
export async function currentActivePlayer(): Promise<(GamePlayer & { participation: string | null }) | null> {
  const player = await currentPlayer();
  if (!player || player.role !== "STAGIAIRE") return null;
  const participation = await effectiveParticipation(player);
  return participation === "ACCEPTED" ? { ...player, participation } : null;
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

// Lancer les inscriptions et désigner / remplacer le maître du jeu : le directeur de la session (ou
// le super-admin). Ce droit ne donne pas accès aux secrets.
export async function getGameDirectorAuth(): Promise<{ ok: true; formationId: string | null } | { ok: false }> {
  if (await getSession()) return { ok: true, formationId: null };
  const player = await currentPlayer();
  if (player?.role === "DIRECTEUR") return { ok: true, formationId: player.formationId };
  return { ok: false };
}
