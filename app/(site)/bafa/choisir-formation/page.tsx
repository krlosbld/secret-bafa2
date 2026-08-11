import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDirectorAccountSession } from "@/lib/directorAuth";
import ChooseFormationList from "./ChooseFormationList";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ChooseFormationPage() {
  const session = await getDirectorAccountSession();
  if (!session) redirect("/admin/login");

  const players = await prisma.player.findMany({
    where: { directorAccountId: session.directorAccountId },
    select: { id: true, formation: { select: { name: true, active: true } } },
    orderBy: { formation: { createdAt: "desc" } },
  });

  const options = players.map((p) => ({
    playerId: p.id,
    formationName: p.formation.name,
    active: p.formation.active,
  }));

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 480 }}>
        <h1 className="h1">Choisis ta formation</h1>
        <p className="sub" style={{ marginBottom: 20 }}>
          Ton compte est rattaché à plusieurs formations — laquelle veux-tu gérer ?
        </p>
        <ChooseFormationList options={options} />
      </div>
    </main>
  );
}
