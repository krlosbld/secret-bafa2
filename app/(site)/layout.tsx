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

// Lien « Gestion du jeu » : super-admin, directeur de la session ouverte (lancement, maître du jeu),
// maître du jeu désigné (administration du jeu).
async function canManageGame(): Promise<boolean> {
  if (isSuperAdmin(await getSession())) return true;
  const playerSession = await getPlayerSession();
  if (!playerSession) return false;
  const player = await prisma.player.findUnique({ where: { id: playerSession.playerId }, select: { role: true, isGameMaster: true } });
  return player?.role === "DIRECTEUR" || !!player?.isGameMaster;
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ImpersonationBanner />
      <AppNav />
      <GameSubNav canManage={await canManageGame()} />
      {children}
      <RulesModal />
      <PersonalNoteGate />
      <PendingEvaluationsGate />
      <GameInvitationGate />
    </>
  );
}
