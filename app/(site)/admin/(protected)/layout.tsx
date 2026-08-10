import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getPlayerSession } from "@/lib/playerAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    const playerSession = await getPlayerSession();
    if (playerSession) {
      const player = await prisma.player.findUnique({
        where: { id: playerSession.playerId },
        select: { role: true },
      });
      if (player?.role === "DIRECTEUR") {
        redirect("/bafa?tab=admin");
      }
    }
    redirect("/admin/login");
  }
  return <>{children}</>;
}
