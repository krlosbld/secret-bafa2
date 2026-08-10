import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { AdminSecretsPending, AdminSecretsPublished } from "../../../AdminSecrets";
import AdminBuzzPending from "../../../AdminBuzzPending";
import AdminPlayers from "../../../AdminPlayers";
import AdminStaffList from "../../../AdminStaffList";
import AdminCreateCode from "../../../AdminCreateCode";
import AdminActivateFormation from "../../../AdminActivateFormation";
import AdminReset from "../../../AdminReset";
import AdminCronControls from "../../../AdminCronControls";
import LogoutClient from "../../../LogoutClient";

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

  // "Joueurs" : stagiaires et tout le monde qui participe réellement au jeu (a un secret),
  // même un formateur/directeur qui joue aussi.
  const players = superAdmin
    ? await prisma.player.findMany({
        where: { formationId, OR: [{ role: "STAGIAIRE" }, { secret: { isNot: null } }] },
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

  // "Équipe" : comptes formateur/directeur purement administratifs, sans secret (ne jouent pas).
  const staff = superAdmin
    ? await prisma.player.findMany({
        where: { formationId, role: { in: ["FORMATEUR", "DIRECTEUR"] }, secret: null },
        orderBy: { firstName: "asc" },
        select: { id: true, firstName: true, role: true, username: true },
      })
    : [];

  const quotaConfig =
    superAdmin && formation.active
      ? await prisma.config.findUnique({ where: { formationId_key: { formationId, key: "buzzQuota" } } })
      : null;
  const quota = Number(quotaConfig?.value ?? 3);

  let lastNightlyRun: { at: string; updated: number } | null = null;
  if (superAdmin && formation.active) {
    const lastNightlyRunConfig = await prisma.config.findUnique({
      where: { formationId_key: { formationId, key: "lastNightlyRun" } },
    });
    if (lastNightlyRunConfig) {
      try {
        lastNightlyRun = JSON.parse(lastNightlyRunConfig.value);
      } catch {
        lastNightlyRun = null;
      }
    }
  }

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
          {formation.active ? (
            <span style={{ fontSize: 12, fontWeight: 800, color: "#16a34a", background: "#dcfce7", padding: "2px 8px", borderRadius: 999 }}>
              Active
            </span>
          ) : (
            superAdmin && <AdminActivateFormation formationId={formation.id} formationName={formation.name} />
          )}
        </div>
        <p className="sub" style={{ marginBottom: 32 }}>
          Créée le {new Date(formation.createdAt).toLocaleDateString("fr-FR")} · Code de session :{" "}
          <span style={{ fontWeight: 900, color: "#0f766e" }}>{formation.code}</span>
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
            <Section title="Codes">
              <AdminCreateCode formationId={formation.id} />
            </Section>

            <Section title={`Équipe (${staff.length})`}>
              <AdminStaffList staff={staff} />
            </Section>

            <Section title={`Joueurs (${players.length})`}>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <AdminPlayers players={players as any} quota={quota} showQuota={formation.active} />
            </Section>

            {formation.active && (
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
                  <AdminCronControls formationId={formation.id} />
                </div>
              </Section>
            )}

            <Section title="Réinitialisation">
              <AdminReset formationId={formation.id} formationName={formation.name} />
            </Section>
          </>
        )}
      </div>
    </main>
  );
}
