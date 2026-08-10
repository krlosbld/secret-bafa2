import { getFormationFromCookie } from "@/lib/formationSession";
import SessionCodeGate from "@/components/SessionCodeGate";
import RankingClient from "./RankingClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RankingPage() {
  const formation = await getFormationFromCookie();
  if (!formation) {
    return <SessionCodeGate />;
  }

  return <RankingClient />;
}
