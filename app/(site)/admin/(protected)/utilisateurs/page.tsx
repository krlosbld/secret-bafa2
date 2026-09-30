import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSuperAdminActor } from "@/lib/adminActor";
import AdminNav from "../../AdminNav";
import LogoutClient from "../../LogoutClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Utilisateurs — Administration BafaPilot" };

const LEVELS: Record<string, { label: string; bg: string; color: string }> = {
  SUPERADMIN: { label: "Super-admin", bg: "#ede9fe", color: "#5b21b6" },
  GESTIONNAIRE: { label: "Gestionnaire", bg: "#e0f2fe", color: "#075985" },
};
const ROLE_LABELS: Record<string, string> = { DIRECTEUR: "Directeur", FORMATEUR: "Formateur" };

const pill = (bg: string, color: string): React.CSSProperties => ({
  fontSize: 11,
  fontWeight: 800,
  padding: "2px 8px",
  borderRadius: 999,
  background: bg,
  color,
  whiteSpace: "nowrap",
});

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  if (!(await getSuperAdminActor())) redirect("/admin");

  const { q: rawQ } = await searchParams;
  const q = (rawQ ?? "").trim().slice(0, 100);
  const words = q.split(/\s+/).filter(Boolean).slice(0, 3);

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: words.length
        ? {
            AND: words.map((w) => ({
              OR: [
                { firstName: { contains: w, mode: "insensitive" as const } },
                { lastName: { contains: w, mode: "insensitive" as const } },
                { email: { contains: w, mode: "insensitive" as const } },
              ],
            })),
          }
        : {},
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        emailVerifiedAt: true,
        platformRole: true,
        createdAt: true,
        memberships: { select: { role: true, formation: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.user.count(),
  ]);

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

        <form method="get" style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          <input
            name="q"
            defaultValue={q}
            placeholder="Rechercher par nom, prénom ou email"
            style={{ flex: "1 1 260px", border: "1px solid #ddd", borderRadius: 8, padding: "9px 12px", fontSize: 14 }}
          />
          <button className="btn btn-main" type="submit">
            Rechercher
          </button>
          {q && (
            <Link className="btn btn-ghost" href="/admin/utilisateurs" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
              Effacer
            </Link>
          )}
        </form>

        <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 12px" }}>
          {q ? `${users.length} résultat(s) pour « ${q} » · ` : ""}
          {total} compte(s) au total
        </p>

        {users.length === 0 ? (
          <p style={{ color: "#64748b" }}>Aucun compte.</p>
        ) : (
          <div className="cards">
            {users.map((u) => (
              <Link key={u.id} href={`/admin/utilisateurs/${u.id}`} className="card" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, color: "#0f172a", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      {u.firstName} {u.lastName}
                      {LEVELS[u.platformRole] && <span style={pill(LEVELS[u.platformRole].bg, LEVELS[u.platformRole].color)}>{LEVELS[u.platformRole].label}</span>}
                      {u.emailVerifiedAt ? (
                        <span style={pill("#dcfce7", "#166534")}>Email confirmé</span>
                      ) : (
                        <span style={pill("#fef3c7", "#92400e")}>Email non confirmé</span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: "#64748b", wordBreak: "break-all" }}>{u.email}</div>
                    <div style={{ fontSize: 13, color: "#334155", marginTop: 6 }}>
                      {u.memberships.length === 0
                        ? "Aucune session"
                        : u.memberships.map((m) => `${m.formation.name} (${ROLE_LABELS[m.role] ?? m.role})`).join(" · ")}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap" }}>
                    Inscrit le {u.createdAt.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
