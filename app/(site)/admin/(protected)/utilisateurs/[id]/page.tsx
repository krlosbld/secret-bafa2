import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSuperAdminActor, AUDIT_LABELS } from "@/lib/adminActor";
import AdminNav from "../../../AdminNav";
import LogoutClient from "../../../LogoutClient";
import UserActions from "./UserActions";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = { DIRECTEUR: "Directeur", FORMATEUR: "Formateur" };
const fmt = (d: Date) => d.toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" });
const fmtDay = (d: Date | null) => (d ? d.toLocaleDateString("fr-FR", { timeZone: "UTC" }) : "?");

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 12px", color: "#0f172a" }}>{title}</h2>
      {children}
    </section>
  );
}

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getSuperAdminActor();
  if (!actor) redirect("/admin");

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      emailVerifiedAt: true,
      platformRole: true,
      createdAt: true,
      memberships: {
        select: { role: true, formation: { select: { id: true, name: true, startDate: true, endDate: true } }, player: { select: { firstName: true } } },
        orderBy: { createdAt: "desc" },
      },
      managedFormations: { select: { formation: { select: { id: true, name: true } } } },
      sessions: { where: { expiresAt: { gt: new Date() } }, select: { createdAt: true, lastUsedAt: true, impersonatorId: true } },
    },
  });
  if (!user) notFound();

  const [formations, logs] = await Promise.all([
    prisma.formation.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "desc" } }),
    prisma.adminAuditLog.findMany({ where: { targetUserId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  const lastActivity = user.sessions.filter((s) => !s.impersonatorId).map((s) => s.lastUsedAt).sort((a, b) => b.getTime() - a.getTime())[0];

  return (
    <main className="page">
      <div className="container">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h1 className="h1" style={{ margin: 0 }}>
            Administration
          </h1>
          <LogoutClient />
        </div>
        <AdminNav active="utilisateurs" />
        <Link href="/admin/utilisateurs" className="btn btn-ghost" style={{ textDecoration: "none", display: "inline-block", marginBottom: 16 }}>
          ← Utilisateurs
        </Link>

        <div className="card" style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>
            {user.firstName} {user.lastName}
          </div>
          <div style={{ color: "#475569", wordBreak: "break-all" }}>{user.email}</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 8, lineHeight: 1.7 }}>
            Inscrit le {fmt(user.createdAt)}
            <br />
            Email : {user.emailVerifiedAt ? `confirmé le ${fmt(user.emailVerifiedAt)}` : "non confirmé"}
            <br />
            Connexions actives : {user.sessions.filter((s) => !s.impersonatorId).length}
            {lastActivity ? ` · dernière activité ${fmt(lastActivity)}` : ""}
          </div>
        </div>

        <Section title={`Sessions (${user.memberships.length})`}>
          {user.memberships.length === 0 ? (
            <p style={{ color: "#64748b", fontSize: 14 }}>Rattaché à aucune session. Pour l&apos;ajouter, ouvrez la fiche d&apos;une formation, section « Équipe ».</p>
          ) : (
            <div className="cards">
              {user.memberships.map((m) => (
                <Link key={m.formation.id} href={`/admin/formations/${m.formation.id}`} className="card" style={{ textDecoration: "none", color: "inherit" }}>
                  <strong>{m.formation.name}</strong> — {ROLE_LABELS[m.role] ?? m.role}
                  <div style={{ fontSize: 13, color: "#64748b" }}>
                    {m.formation.startDate ? `Du ${fmtDay(m.formation.startDate)} au ${fmtDay(m.formation.endDate)}` : "Dates non renseignées"}
                    {m.player ? ` · fiche « ${m.player.firstName} »` : ""}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Section>

        <UserActions
          user={{
            id: user.id,
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
            verified: !!user.emailVerifiedAt,
            platformRole: user.platformRole,
            isSelf: actor.userId === user.id,
          }}
          managed={user.managedFormations.map((m) => m.formation)}
          formations={formations}
        />

        <Section title="Historique admin de ce compte">
          {logs.length === 0 ? (
            <p style={{ color: "#64748b", fontSize: 14 }}>Aucune action d&apos;administration sur ce compte.</p>
          ) : (
            <div className="card" style={{ fontSize: 13, lineHeight: 1.7 }}>
              {logs.map((l) => (
                <div key={l.id}>
                  <span style={{ color: "#64748b" }}>{fmt(l.createdAt)}</span> · <strong>{AUDIT_LABELS[l.action] ?? l.action}</strong>
                  {l.details ? ` — ${l.details}` : ""} <span style={{ color: "#94a3b8" }}>par {l.actorLabel}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </main>
  );
}
