import { getGameFormation } from "@/lib/gameFormation";
import SessionAccessGate from "@/components/SessionAccessGate";
import RankingClient from "./RankingClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RankingPage() {
  const formation = await getGameFormation();
  if (!formation) {
    return <SessionAccessGate next="/ranking" title="Classement" />;
  }

  return <RankingClient />;
}
