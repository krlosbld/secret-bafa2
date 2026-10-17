import { getGameFormation } from "@/lib/gameFormation";
import SessionAccessGate from "@/components/SessionAccessGate";
import RankingClient from "./RankingClient";
import { redirect } from "next/navigation";
import { gameClosedForCurrentPlayer } from "@/lib/gameAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RankingPage() {
  const formation = await getGameFormation();
  if (!formation) {
    return <SessionAccessGate next="/ranking" title="Classement" />;
  }
  if (await gameClosedForCurrentPlayer()) redirect("/bafa");

  return <RankingClient />;
}
