import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getManagerActor } from "@/lib/adminActor";
import { canManageFormation } from "@/lib/access";
import { loadTeam } from "@/lib/team";
import TeamManager from "@/components/TeamManager";
import SessionSettingsForm from "@/components/SessionSettingsForm";
import { getSessionSettings } from "@/lib/sessionSettings";

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
  const [team, settings] = await Promise.all([loadTeam(formationId), getSessionSettings(formationId)]);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <Link href="/gestion" className="bp-link">
        ← Mes sessions à gérer
      </Link>
      <h1 className="bp-auth__title" style={{ textAlign: "left", margin: "16px 0 4px" }}>
        {formation.name}
      </h1>
      <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: "24px 0 12px" }}>Réglages de la session</h2>
      <SessionSettingsForm formationId={formation.id} initial={settings!} />
      <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: "32px 0 4px" }}>Équipe</h2>
      <p style={{ color: "var(--bp-muted)", margin: "0 0 16px" }}>Le rattachement est immédiat, sans code de session.</p>
      <TeamManager formationId={formation.id} members={team.members} linkable={team.linkable} />
    </div>
  );
}
