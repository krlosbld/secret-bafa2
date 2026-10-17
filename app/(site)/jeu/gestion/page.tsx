import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { getPlayerSession } from "@/lib/playerAuth";
import { getGameFormation } from "@/lib/gameFormation";
import { getGameState } from "@/lib/gameAccess";
import { GAME_RULES } from "@/lib/gameRules";
import GameAdminPanel from "./GameAdminPanel";
import DirectorGameControls from "./DirectorGameControls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gestion du jeu — Secret BAFA" };

// Gestion du Jeu des secrets d'une session :
// - le directeur lance le jeu et choisit / remplace le maître du jeu (sans accès aux secrets) ;
// - le maître du jeu désigné administre le jeu (réglages, secrets, buzz, joueurs) ;
// - le super-admin a les deux, plus la réinitialisation. Tous les autres sont renvoyés vers le jeu.
export default async function GameManagementPage() {
  const formation = await getGameFormation();
  if (!formation) redirect("/jeu");

  const superAdmin = isSuperAdmin(await getSession());
  let isDirector = superAdmin;
  let isGameMaster = superAdmin;
  if (!superAdmin) {
    const playerSession = await getPlayerSession();
    const player = playerSession
      ? await prisma.player.findUnique({ where: { id: playerSession.playerId }, select: { role: true, isGameMaster: true, formationId: true } })
      : null;
    isDirector = player?.role === "DIRECTEUR" && player.formationId === formation.id;
    isGameMaster = !!player?.isGameMaster && player.formationId === formation.id;
    if (!isDirector && !isGameMaster) redirect("/jeu");
  }

  const state = await getGameState(formation.id);

  // Équipe pouvant être maître du jeu : directeurs et formateurs rattachés à la session (avec compte).
  const [staff, configRows] = isDirector
    ? await Promise.all([
        prisma.formationMember.findMany({
          where: { formationId: formation.id, role: { in: ["DIRECTEUR", "FORMATEUR"] }, playerId: { not: null } },
          select: { playerId: true, role: true, user: { select: { firstName: true, lastName: true } } },
          orderBy: [{ role: "asc" }, { user: { firstName: "asc" } }],
        }),
        prisma.config.findMany({ where: { formationId: formation.id, key: { in: ["buzzQuota", ...GAME_RULES.map((r) => r.key)] } } }),
      ])
    : [[], []];
  const values = new Map(configRows.map((r) => [r.key, r.value]));

  return (
    <main className="page">
      <div className="container">
        <h1 className="h1" style={{ margin: "0 0 4px" }}>
          Gestion du jeu
        </h1>
        <p className="sub" style={{ marginBottom: 24 }}>
          {formation.name} — Jeu des secrets.
        </p>

        {isDirector && (
          <DirectorGameControls
            launched={state.launched}
            launchedAt={state.launchedAt}
            ended={state.ended}
            gameMaster={state.gameMaster}
            staff={staff.map((m) => ({
              playerId: m.playerId!,
              name: `${m.user.firstName} ${m.user.lastName}`,
              role: m.role === "DIRECTEUR" ? "Directeur" : "Formateur",
            }))}
            defaults={{
              buzzQuota: Number(values.get("buzzQuota") ?? 3),
              rules: Object.fromEntries(GAME_RULES.map((r) => [r.key, values.get(r.key) === "true"])),
            }}
          />
        )}

        {state.launched && isGameMaster && (
          <GameAdminPanel formationId={formation.id} formationName={formation.name} canReset={superAdmin} canManageIdentity={isDirector} />
        )}
        {state.launched && !isGameMaster && (
          <p className="sub" style={{ marginTop: 16 }}>
            Les secrets, les buzz et les réglages du jeu sont réservés au maître du jeu.
          </p>
        )}
      </div>
    </main>
  );
}
