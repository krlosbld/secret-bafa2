import Navbar from "@/components/Navbar";
import RulesModal from "@/components/RulesModal";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
      <RulesModal />
    </>
  );
}