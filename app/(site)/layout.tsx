import AppNav from "@/components/AppNav";
import GameSubNav from "@/components/GameSubNav";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import RulesModal from "@/components/RulesModal";
import RuleChangeAnnouncement from "@/components/RuleChangeAnnouncement";
import LeaderPrivilegeGate from "@/components/LeaderPrivilegeGate";
import PersonalNoteGate from "@/components/PersonalNoteGate";
import PendingEvaluationsGate from "@/components/PendingEvaluationsGate";
import GameInvitationGate from "@/components/GameInvitationGate";
import { prisma } from "@/lib/prisma";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { getPlayerSession } from "@/lib/playerAuth";
import { getGameFormation } from "@/lib/gameFormation";
import { currentActivePlayer, getGameStatus } from "@/lib/gameAccess";

// Barre du jeu de la session ouverte : affichée une fois les inscriptions lancées ; « Classement »
// dès que la partie a commencé ; « Gestion du jeu » pour le maître du jeu (et le super-admin) ;
// « Ajouter mon secret » pour un participant, pendant les inscriptions.
async function gameNav(): Promise<{ launched: boolean; showRanking: boolean; canManage: boolean; canPropose: boolean }> {
  const formation = await getGameFormation();
  if (!formation) return { launched: false, showRanking: false, canManage: false, canPropose: false };
  const status = await getGameStatus(formation.id);
  const base = { launched: status !== "non_configure", showRanking: status === "en_cours" || status === "termine" };
  if (isSuperAdmin(await getSession())) return { ...base, canManage: true, canPropose: false };
  const playerSession = await getPlayerSession();
  const player = playerSession
    ? await prisma.player.findUnique({ where: { id: playerSession.playerId }, select: { isGameMaster: true } })
    : null;
  const active = status === "inscriptions_ouvertes" ? await currentActivePlayer() : null;
  return { ...base, canManage: !!player?.isGameMaster, canPropose: !!active };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ImpersonationBanner />
      <AppNav />
      <GameSubNav {...await gameNav()} />
      {children}
      <RulesModal />
      <RuleChangeAnnouncement />
      <LeaderPrivilegeGate />
      <PersonalNoteGate />
      <PendingEvaluationsGate />
      <GameInvitationGate />
    </>
  );
}
