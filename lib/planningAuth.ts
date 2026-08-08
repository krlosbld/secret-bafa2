import { getSession } from "@/lib/auth";
import { getPlayerSession } from "@/lib/playerAuth";
import { prisma } from "@/lib/prisma";

const STAFF_ROLES = ["FORMATEUR", "DIRECTEUR"];

export async function canEditPlanning(): Promise<boolean> {
  const adminSession = await getSession();
  if (adminSession) return true;

  const playerSession = await getPlayerSession();
  if (!playerSession) return false;

  const player = await prisma.player.findUnique({
    where: { id: playerSession.playerId },
    select: { role: true },
  });

  return !!player && STAFF_ROLES.includes(player.role);
}
