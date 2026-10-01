import { getFormationFromCookie } from "@/lib/formationSession";
import SessionAccessGate from "@/components/SessionAccessGate";
import { getPlayerSession } from "@/lib/playerAuth";
import { getSession } from "@/lib/auth";
import RankingClient from "./RankingClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RankingPage() {
  const formation = await getFormationFromCookie();
  const allowed = formation && ((await getPlayerSession()) || (await getSession()));
  if (!formation || !allowed) {
    return <SessionAccessGate next="/ranking" title="Classement" />;
  }

  return <RankingClient />;
}
