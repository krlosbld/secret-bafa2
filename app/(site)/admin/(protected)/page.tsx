import { prisma } from "@/lib/prisma";
import { getSession, isSuperAdmin } from "@/lib/auth";
import AdminManagers from "../AdminManagers";
import AdminFormations from "../AdminFormations";
import LogoutClient from "../LogoutClient";

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

export default async function AdminPage() {
  const session = await getSession();
  const superAdmin = isSuperAdmin(session);

  const formations = await prisma.formation.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, code: true, active: true, createdAt: true, _count: { select: { players: true } } },
  });

  const managers = superAdmin
    ? await prisma.manager.findMany({
        select: { id: true, username: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      })
    : [];

  return (
    <main className="page">
      <div className="container">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 4,
          }}
        >
          <h1 className="h1" style={{ margin: 0 }}>
            Administration
          </h1>
          <LogoutClient />
        </div>
        <p className="sub" style={{ marginBottom: 32 }}>
          {superAdmin ? "Super-admin" : "Gestionnaire"} · Session 10 min
        </p>

        <Section title="Formations">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <AdminFormations formations={formations as any} canCreate={superAdmin} />
        </Section>

        {superAdmin && (
          <Section title="Gestionnaires">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <AdminManagers managers={managers as any} />
          </Section>
        )}
      </div>
    </main>
  );
}
