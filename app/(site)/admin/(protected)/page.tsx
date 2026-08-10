import { prisma } from "@/lib/prisma";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { getActiveFormation } from "@/lib/formation";
import { AdminSecretsPending, AdminSecretsPublished } from "../AdminSecrets";
import AdminBuzzPending from "../AdminBuzzPending";
import AdminPlayers from "../AdminPlayers";
import AdminManagers from "../AdminManagers";
import AdminFormations from "../AdminFormations";
import LogoutClient from "../LogoutClient";
import AdminReset from "../AdminReset";

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
  const activeFormation = await getActiveFormation();
  const formationId = activeFormation.id;

  const [pendingSecrets, publishedSecrets, pendingBuzzes] = await Promise.all([
    prisma.secret.findMany({
      where: { status: "PENDING", formationId },
      orderBy: { createdAt: "asc" },
      include: {
        player: { select: { firstName: true, code: true } },
        foundBy: { select: { firstName: true } },
      },
    }),
    prisma.secret.findMany({
      where: { status: { in: ["PUBLISHED", "FOUND"] }, formationId },
      orderBy: { createdAt: "desc" },
      include: {
        player: { select: { firstName: true, code: true } },
        foundBy: { select: { firstName: true } },
      },
    }),
    prisma.buzz.findMany({
      where: { status: "PENDING", secret: { formationId } },
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
        where: { formationId },
        orderBy: { firstName: "asc" },
        select: {
          id: true,
          firstName: true,
          code: true,
          role: true,
          points: true,
          buzzCount: true,
          secret: { select: { status: true, content: true, bonus: true } },
        },
      })
    : [];

  const managers = superAdmin
    ? await prisma.manager.findMany({
        select: { id: true, username: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const formations = superAdmin
    ? await prisma.formation.findMany({
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, active: true, createdAt: true, _count: { select: { players: true } } },
      })
    : [];

  const quotaConfig = superAdmin
    ? await prisma.config.findUnique({ where: { formationId_key: { formationId, key: "buzzQuota" } } })
    : null;
  const quota = Number(quotaConfig?.value ?? 3);

  const lastNightlyRunConfig = superAdmin
    ? await prisma.config.findUnique({ where: { formationId_key: { formationId, key: "lastNightlyRun" } } })
    : null;
  let lastNightlyRun: { at: string; updated: number } | null = null;
  if (lastNightlyRunConfig) {
    try {
      lastNightlyRun = JSON.parse(lastNightlyRunConfig.value);
    } catch {
      lastNightlyRun = null;
    }
  }

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

        <Section title={`Buzz à valider (${pendingBuzzes.length})`}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <AdminBuzzPending buzzes={pendingBuzzes as any} />
        </Section>

        <Section title={`Secrets en attente (${pendingSecrets.length})`}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <AdminSecretsPending secrets={pendingSecrets as any} />
        </Section>

        <Section title={`Secrets validés (${publishedSecrets.length})`}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <AdminSecretsPublished secrets={publishedSecrets as any} />
        </Section>

        {superAdmin && (
          <>
            <Section title="Formations">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <AdminFormations formations={formations as any} />
            </Section>

            <Section title={`Joueurs (${players.length})`}>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <AdminPlayers players={players as any} quota={quota} />
            </Section>

            <Section title="Gestionnaires">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <AdminManagers managers={managers as any} />
            </Section>

            <Section title="Cron nocturne (reset buzz + points)">
              <div className="card">
                {lastNightlyRun ? (
                  <>
                    <div className="row">
                      <div className="label">Dernière exécution</div>
                      <div className="value">
                        {new Date(lastNightlyRun.at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}
                      </div>
                    </div>
                    <div className="row">
                      <div className="label">Joueurs mis à jour</div>
                      <div className="value">+1 pt pour {lastNightlyRun.updated} joueur(s)</div>
                    </div>
                  </>
                ) : (
                  <p style={{ color: "#dc2626", fontWeight: 700 }}>Jamais exécuté depuis la mise en place de ce suivi.</p>
                )}
              </div>
            </Section>

            <Section title="Réinitialisation">
              <AdminReset />
            </Section>
          </>
        )}
      </div>
    </main>
  );
}
