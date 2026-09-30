import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getManagerActor } from "@/lib/adminActor";
import { canManageFormation } from "@/lib/access";
import { loadTeam } from "@/lib/team";
import TeamManager from "@/components/TeamManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Équipe de la session — BafaPilot" };

export default async function GestionFormationPage({ params }: { params: Promise<{ formationId: string }> }) {
  const actor = await getManagerActor();
  if (!actor) redirect("/sessions");
  const { formationId } = await params;
  // Contrôle côté serveur : un gestionnaire n'accède qu'aux sessions qui lui sont attribuées.
  if (actor.kind === "gestionnaire" && !(await canManageFormation(formationId))) redirect("/gestion");

  const formation = await prisma.formation.findUnique({ where: { id: formationId }, select: { id: true, name: true } });
  if (!formation) notFound();
  const team = await loadTeam(formationId);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <Link href="/gestion" className="bp-link">
        ← Mes sessions à gérer
      </Link>
      <h1 className="bp-auth__title" style={{ textAlign: "left", margin: "16px 0 4px" }}>
        {formation.name}
      </h1>
      <p style={{ color: "var(--bp-muted)", margin: "0 0 24px" }}>Équipe de la session — le rattachement est immédiat, sans code de session.</p>
      <TeamManager formationId={formation.id} members={team.members} linkable={team.linkable} />
    </div>
  );
}
