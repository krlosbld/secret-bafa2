import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession, isSuperAdmin } from "@/lib/auth";
import AdminStaffList from "../../../AdminStaffList";
import AdminActivateFormation from "../../../AdminActivateFormation";
import OpenGameManagement from "../../../OpenGameManagement";
import LogoutClient from "../../../LogoutClient";
import TeamManager from "@/components/TeamManager";
import { loadTeam } from "@/lib/team";
import SessionSettingsForm from "@/components/SessionSettingsForm";
import InviteStagiaires from "@/components/InviteStagiaires";
import { getSessionSettings } from "@/lib/sessionSettings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 14px", color: "#0f172a" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function FormationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const superAdmin = isSuperAdmin(session);
  const { id: formationId } = await params;

  const formation = await prisma.formation.findUnique({ where: { id: formationId } });
  if (!formation) notFound();

  // "Équipe" : tous les comptes formateur/directeur, qu'ils jouent aussi au jeu ou non — un formateur
  // avec un secret reste un formateur, il apparaît alors dans les deux listes.
  const staffRows = superAdmin
    ? await prisma.player.findMany({
        where: { formationId, role: { in: ["FORMATEUR", "DIRECTEUR"] } },
        orderBy: { firstName: "asc" },
        select: { id: true, firstName: true, role: true, isGameMaster: true, directorAccount: { select: { username: true } } },
      })
    : [];
  const staff = staffRows.map((s) => ({ id: s.id, firstName: s.firstName, role: s.role, isGameMaster: s.isGameMaster, username: s.directorAccount?.username ?? null }));

  const team = superAdmin ? await loadTeam(formationId) : null;
  const settings = superAdmin ? await getSessionSettings(formationId) : null;

  return (
    <main className="page">
      <div className="container">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
          <Link className="btn btn-ghost" href="/admin">
            ← Formations
          </Link>
          <LogoutClient />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, marginBottom: 4, flexWrap: "wrap" }}>
          <h1 className="h1" style={{ margin: 0 }}>
            {formation.name}
          </h1>
          {formation.active && (
            <span style={{ fontSize: 12, fontWeight: 800, color: "#16a34a", background: "#dcfce7", padding: "2px 8px", borderRadius: 999 }}>
              Active
            </span>
          )}
          {superAdmin && (
            <AdminActivateFormation formationId={formation.id} formationName={formation.name} active={formation.active} />
          )}
        </div>
        <p className="sub" style={{ marginBottom: 32 }}>
          Créée le {new Date(formation.createdAt).toLocaleDateString("fr-FR")}
        </p>

        {superAdmin && (
          <Section title="Réglages de la session">
            <div style={{ maxWidth: 560 }}>
              <SessionSettingsForm formationId={formation.id} initial={settings!} />
            </div>
          </Section>
        )}

        {superAdmin && (
          <>
            <Section title="Stagiaires — inscription par QR code">
              <InviteStagiaires formationId={formation.id} sessionName={formation.name} />
            </Section>

            <Section title={`Équipe — comptes BafaPilot (${team!.members.length})`}>
              <TeamManager formationId={formation.id} members={team!.members} linkable={team!.linkable} invites={team!.invites} />
            </Section>

            <Section title={`Fiches d'équipe (${staff.length})`}>
              <AdminStaffList staff={staff} />
            </Section>

            <Section title="Jeu Secret BAFA 🤫">
              <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <p style={{ margin: 0, color: "#475569" }}>
                  Buzz, secrets, joueurs, maître de jeu, cron et réinitialisation se gèrent dans l&apos;onglet Jeu.
                </p>
                <OpenGameManagement formationId={formation.id} />
              </div>
            </Section>
          </>
        )}
      </div>
    </main>
  );
}
