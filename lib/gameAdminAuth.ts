import { getGameMasterAuth } from "@/lib/gameAccess";

// Administration du Jeu des secrets : réservée au maître du jeu désigné de la session (et au
// super-admin / gestionnaire). Le directeur lance le jeu et choisit le maître du jeu, mais n'a pas
// accès aux secrets ni aux réglages s'il n'est pas lui-même maître du jeu (voir lib/gameAccess).
// formationId: null = super-admin/gestionnaire (formation résolue ensuite) ; sinon la session du maître du jeu.
export type GameAdminAuth = { ok: true; formationId: string | null } | { ok: false };

async function gameMasterOnly(): Promise<GameAdminAuth> {
  const auth = await getGameMasterAuth();
  return auth.ok ? { ok: true, formationId: auth.formationId } : { ok: false };
}

// Réglages, fin du jeu, buzz, points…
export const getGameAdminAuth = gameMasterOnly;
// Secrets, leurres, règles, validation des buzz.
export const getSecretsAdminAuth = gameMasterOnly;
