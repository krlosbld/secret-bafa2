import AppNav from "@/components/AppNav";
import GameSubNav from "@/components/GameSubNav";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import RulesModal from "@/components/RulesModal";
import PersonalNoteGate from "@/components/PersonalNoteGate";
import PendingEvaluationsGate from "@/components/PendingEvaluationsGate";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ImpersonationBanner />
      <AppNav />
      <GameSubNav />
      {children}
      <RulesModal />
      <PersonalNoteGate />
      <PendingEvaluationsGate />
    </>
  );
}
