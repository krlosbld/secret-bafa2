import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSuperAdminActor, AUDIT_LABELS } from "@/lib/adminActor";
import AdminNav from "../../AdminNav";
import LogoutClient from "../../LogoutClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Journal — Administration BafaPilot" };

const fmt = (d: Date) => d.toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "medium" });

// Journal des actions sensibles de l'administration (200 dernières).
export default async function JournalPage() {
  if (!(await getSuperAdminActor())) redirect("/admin");

  const logs = await prisma.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const formationIds = [...new Set(logs.map((l) => l.formationId).filter((x): x is string => !!x))];
  const formations = await prisma.formation.findMany({ where: { id: { in: formationIds } }, select: { id: true, name: true } });
  const formationName = new Map(formations.map((f) => [f.id, f.name]));

  return (
    <main className="page">
      <div className="container">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h1 className="h1" style={{ margin: 0 }}>
            Administration
          </h1>
          <LogoutClient />
        </div>
        <AdminNav active="journal" />
        <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 12px" }}>
          Connexions « en tant que », suppressions, mots de passe modifiés, niveaux et rattachements — 200 dernières actions.
        </p>

        {logs.length === 0 ? (
          <p style={{ color: "#64748b" }}>Aucune action enregistrée pour l&apos;instant.</p>
        ) : (
          <div className="cards">
            {logs.map((l) => (
              <div key={l.id} className="card" style={{ fontSize: 14, lineHeight: 1.6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <strong>{AUDIT_LABELS[l.action] ?? l.action}</strong>
                  <span style={{ color: "#94a3b8", fontSize: 12 }}>{fmt(l.createdAt)}</span>
                </div>
                <div style={{ color: "#334155" }}>
                  {l.targetLabel &&
                    (l.targetUserId ? (
                      <Link href={`/admin/utilisateurs/${l.targetUserId}`} style={{ color: "#0f766e", fontWeight: 700 }}>
                        {l.targetLabel}
                      </Link>
                    ) : (
                      <span>{l.targetLabel}</span>
                    ))}
                  {l.formationId && ` · ${formationName.get(l.formationId) ?? "session supprimée"}`}
                  {l.details && ` · ${l.details}`}
                </div>
                <div style={{ color: "#64748b", fontSize: 12 }}>par {l.actorLabel}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
