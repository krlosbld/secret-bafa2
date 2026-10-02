import AppNav from "@/components/AppNav";
import GameSubNav from "@/components/GameSubNav";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import RulesModal from "@/components/RulesModal";
import PersonalNoteGate from "@/components/PersonalNoteGate";
import PendingEvaluationsGate from "@/components/PendingEvaluationsGate";
import { prisma } from "@/lib/prisma";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { getPlayerSession } from "@/lib/playerAuth";

// Peut gérer le jeu Secret BAFA : super-admin, directeur de la session ouverte, formateur maître de jeu.
async function canManageGame(): Promise<boolean> {
  if (isSuperAdmin(await getSession())) return true;
  const playerSession = await getPlayerSession();
  if (!playerSession) return false;
  const player = await prisma.player.findUnique({ where: { id: playerSession.playerId }, select: { role: true, isGameMaster: true } });
  return player?.role === "DIRECTEUR" || (player?.role === "FORMATEUR" && player.isGameMaster);
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
    </>
  );
}
