import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { getPlayerSession } from "@/lib/playerAuth";
import { getGameFormation } from "@/lib/gameFormation";
import { getGameState } from "@/lib/gameAccess";
import GameAdminPanel from "./GameAdminPanel";
import DirectorGameControls from "./DirectorGameControls";
import { loadDirectorControls } from "./directorControls";
import AdminChallenges from "../../admin/AdminChallenges";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gestion du jeu — Secret BAFA" };

// Gestion du Jeu des secrets : réservée au maître du jeu désigné (et au super-admin), une fois le jeu
// lancé. Le directeur lance le jeu et change de maître du jeu depuis l'onglet Jeu ; s'il est aussi
// maître du jeu, il retrouve ici ce même bloc. Tous les autres sont renvoyés vers le jeu.
export default async function GameManagementPage() {
  const formation = await getGameFormation();
  if (!formation) redirect("/jeu");

  const state = await getGameState(formation.id);
  if (!state.launched) redirect("/jeu");

  const superAdmin = isSuperAdmin(await getSession());
  const playerSession = superAdmin ? null : await getPlayerSession();
  const player = playerSession
    ? await prisma.player.findUnique({ where: { id: playerSession.playerId }, select: { id: true, role: true, isGameMaster: true, formationId: true } })
    : null;
  const isGameMaster = superAdmin || (!!player?.isGameMaster && player.formationId === formation.id);
  if (!isGameMaster) redirect("/jeu");
  const isDirector = superAdmin || (player?.role === "DIRECTEUR" && player.formationId === formation.id);
  const controls = isDirector ? await loadDirectorControls(formation.id, state, player?.id ?? null) : null;

  return (
    <main className="page">
      <div className="container">
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "0 0 4px" }}>
          <h1 className="h1" style={{ margin: 0 }}>
            Gestion du jeu
          </h1>
          {(state.status === "inscriptions_ouvertes" || state.status === "en_cours" || (await prisma.gameChallenge.count({ where: { formationId: formation.id } })) > 0) && <AdminChallenges />}
        </div>
        <p className="sub" style={{ marginBottom: 24 }}>
          {formation.name} — Jeu des secrets.
        </p>
        {controls && <DirectorGameControls {...controls} />}
        <GameAdminPanel formationId={formation.id} formationName={formation.name} canReset={superAdmin} canManageIdentity={isDirector} />
      </div>
    </main>
  );
}
