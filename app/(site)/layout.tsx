import AppNav from "@/components/AppNav";
import GameSubNav from "@/components/GameSubNav";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import RulesModal from "@/components/RulesModal";
import PersonalNoteGate from "@/components/PersonalNoteGate";
import PendingEvaluationsGate from "@/components/PendingEvaluationsGate";
import GameInvitationGate from "@/components/GameInvitationGate";
import { prisma } from "@/lib/prisma";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { getPlayerSession } from "@/lib/playerAuth";
import { getGameFormation } from "@/lib/gameFormation";
import { isGameLaunched } from "@/lib/gameAccess";

// Barre du jeu de la session ouverte : affichée une fois le jeu lancé ; « Gestion du jeu » pour le
// maître du jeu désigné (et le super-admin), « Ajouter mon secret » pour les joueurs.
async function gameNav(): Promise<{ launched: boolean; canManage: boolean; canPropose: boolean }> {
  const formation = await getGameFormation();
  if (!formation) return { launched: false, canManage: false, canPropose: false };
  const launched = await isGameLaunched(formation.id);
  if (isSuperAdmin(await getSession())) return { launched, canManage: true, canPropose: false };
  const playerSession = await getPlayerSession();
  const player = playerSession
    ? await prisma.player.findUnique({ where: { id: playerSession.playerId }, select: { isGameMaster: true } })
    : null;
  return { launched, canManage: !!player?.isGameMaster, canPropose: !player?.isGameMaster };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ImpersonationBanner />
      <AppNav />
      <GameSubNav {...await gameNav()} />
      {children}
      <RulesModal />
      <PersonalNoteGate />
      <PendingEvaluationsGate />
      <GameInvitationGate />
    </>
  );
}
