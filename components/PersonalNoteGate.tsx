import { getPlayerSession } from "@/lib/playerAuth";
import { prisma } from "@/lib/prisma";
import PersonalNoteReminder from "./PersonalNoteReminder";

export default async function PersonalNoteGate() {
  const session = await getPlayerSession();
  if (!session) return null;

  const player = await prisma.player.findUnique({
    where: { id: session.playerId },
    select: { role: true, personalNote: true },
  });
  if (!player || player.role !== "STAGIAIRE") return null;
  if (player.personalNote.trim()) return null;

  return <PersonalNoteReminder playerId={session.playerId} />;
}
