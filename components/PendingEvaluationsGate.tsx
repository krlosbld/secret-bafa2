import { getPlayerSession } from "@/lib/playerAuth";
import { getPendingEvaluations } from "@/lib/pendingEvaluations";
import PendingEvaluationsReminder from "./PendingEvaluationsReminder";

export default async function PendingEvaluationsGate() {
  const session = await getPlayerSession();
  if (!session) return null;

  const blocks = await getPendingEvaluations(session.playerId);
  if (blocks.length === 0) return null;

  return <PendingEvaluationsReminder initialBlocks={blocks} />;
}
