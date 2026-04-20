import { prisma } from "@/lib/prisma";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { AdminSecretsPending, AdminSecretsPublished } from "../AdminSecrets";
import AdminBuzzPending from "../AdminBuzzPending";
import AdminPlayers from "../AdminPlayers";
import AdminManagers from "../AdminManagers";
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

  const [pendingSecrets, publishedSecrets, pendingBuzzes] = await Promise.all([
    prisma.secret.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: {
        player: { select: { firstName: true, code: true } },
        foundBy: { select: { firstName: true } },
      },
    }),
    prisma.secret.findMany({
      where: { status: { in: ["PUBLISHED", "FOUND"] } },
      orderBy: { createdAt: "desc" },
      include: {
        player: { select: { firstName: true, code: true } },
        foundBy: { select: { firstName: true } },
      },
    }),
    prisma.buzz.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: {
        fromPlayer: { select: { firstName: true, code: true } },
        secret: {
          select: {
            content: true,
            bonus: true,
            player: { select: { firstName: true } },
          },
        },
      },
    }),
  ]);

  const players = superAdmin
    ? await prisma.player.findMany({
        orderBy: { firstName: "asc" },
        include: { secret: { select: { status: true, content: true, bonus: true } } },
      })
    : [];

  const managers = superAdmin
    ? await prisma.manager.findMany({
        select: { id: true, username: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const quotaConfig = superAdmin
    ? await prisma.config.findUnique({ where: { key: "buzzQuota" } })
    : null;
  const quota = Number(quotaConfig?.value ?? 3);

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

        <Section title={`Secrets en attente (${pendingSecrets.length})`}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <AdminSecretsPending secrets={pendingSecrets as any} />
        </Section>

        <Section title={`Secrets validés (${publishedSecrets.length})`}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <AdminSecretsPublished secrets={publishedSecrets as any} />
        </Section>

        <Section title={`Buzz à valider (${pendingBuzzes.length})`}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <AdminBuzzPending buzzes={pendingBuzzes as any} />
        </Section>

        {superAdmin && (
          <>
            <Section title={`Joueurs (${players.length})`}>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <AdminPlayers players={players as any} quota={quota} />
            </Section>

            <Section title="Gestionnaires">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <AdminManagers managers={managers as any} />
            </Section>
          </>
        )}
      </div>
    </main>
  );
}
