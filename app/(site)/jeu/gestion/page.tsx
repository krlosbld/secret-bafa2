import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { getPlayerSession } from "@/lib/playerAuth";
import { getGameFormation } from "@/lib/gameFormation";
import GameAdminPanel from "./GameAdminPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gestion du jeu — Secret BAFA" };

// Gestion du jeu Secret BAFA : directeur de la session, formateur maître de jeu (secrets et buzz
// seulement) ou super-admin. Tous les autres sont renvoyés vers le jeu.
export default async function GameManagementPage() {
  const formation = await getGameFormation();
  if (!formation) redirect("/jeu");

  const superAdmin = isSuperAdmin(await getSession());
  let secretsOnly = false;
  if (!superAdmin) {
    const playerSession = await getPlayerSession();
    const player = playerSession
      ? await prisma.player.findUnique({ where: { id: playerSession.playerId }, select: { role: true, isGameMaster: true, formationId: true } })
      : null;
    const isDirector = player?.role === "DIRECTEUR" && player.formationId === formation.id;
    const isGameMaster = player?.role === "FORMATEUR" && player.isGameMaster && player.formationId === formation.id;
    if (!isDirector && !isGameMaster) redirect("/jeu");
    secretsOnly = !isDirector;
  }

  return (
    <main className="page">
      <div className="container">
        <h1 className="h1" style={{ margin: "0 0 4px" }}>
          Gestion du jeu
        </h1>
        <p className="sub" style={{ marginBottom: 24 }}>
          {formation.name} — buzz, secrets, joueurs et règles du Secret BAFA.
        </p>
        <GameAdminPanel formationId={formation.id} formationName={formation.name} secretsOnly={secretsOnly} canReset={superAdmin} />
      </div>
    </main>
  );
}
