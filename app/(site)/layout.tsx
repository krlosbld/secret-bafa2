import Navbar from "@/components/Navbar";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import RulesModal from "@/components/RulesModal";
import PersonalNoteGate from "@/components/PersonalNoteGate";
import PendingEvaluationsGate from "@/components/PendingEvaluationsGate";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ImpersonationBanner />
      <Navbar />
      {children}
      <RulesModal />
      <PersonalNoteGate />
      <PendingEvaluationsGate />
    </>
  );
}