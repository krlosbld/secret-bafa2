import { prisma } from "@/lib/prisma";
import { AdminSecretsPending, AdminSecretsPublished } from "../admin/AdminSecrets";
import AdminBuzzPending from "../admin/AdminBuzzPending";
import AdminPlayers from "../admin/AdminPlayers";
import AdminStaffList from "../admin/AdminStaffList";
import AdminCronControls from "../admin/AdminCronControls";
import AdminCreateCode from "../admin/AdminCreateCode";
import AdminEndGame from "../admin/AdminEndGame";

export default async function AdminTab({ formationId }: { formationId: string }) {
  const [pendingSecrets, publishedSecrets, pendingBuzzes, players, staffRows, quotaConfig, lastNightlyRunConfig, gameEndedConfig] = await Promise.all([
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
    prisma.player.findMany({
      where: { formationId, OR: [{ role: "STAGIAIRE" }, { secret: { isNot: null } }] },
      orderBy: { firstName: "asc" },
      select: {
        id: true,
        firstName: true,
        code: true,
        role: true,
        points: true,
        buzzCount: true,
        buzzQuotaOverride: true,
        secret: { select: { status: true, content: true, bonus: true } },
      },
    }),
    prisma.player.findMany({
      where: { formationId, role: { in: ["FORMATEUR", "DIRECTEUR"] }, secret: null },
      orderBy: { firstName: "asc" },
      select: { id: true, firstName: true, role: true, directorAccount: { select: { username: true } } },
    }),
    prisma.config.findUnique({ where: { formationId_key: { formationId, key: "buzzQuota" } } }),
    prisma.config.findUnique({ where: { formationId_key: { formationId, key: "lastNightlyRun" } } }),
    prisma.config.findUnique({ where: { formationId_key: { formationId, key: "gameEnded" } } }),
  ]);

  const staff = staffRows.map((s) => ({ id: s.id, firstName: s.firstName, role: s.role, username: s.directorAccount?.username ?? null }));

  const quota = Number(quotaConfig?.value ?? 3);
  const gameEnded = gameEndedConfig?.value === "true";

  let lastNightlyRun: { at: string; updated: number } | null = null;
  if (lastNightlyRunConfig) {
    try {
      lastNightlyRun = JSON.parse(lastNightlyRunConfig.value);
    } catch {
      lastNightlyRun = null;
    }
  }

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 14px", color: "#0f172a" }}>{title}</h2>
        {children}
      </section>
    );
  }

  return (
    <div>
      <Section title="Fin du jeu">
        <AdminEndGame formationId={formationId} gameEnded={gameEnded} />
      </Section>

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

      <Section title="Codes">
        <AdminCreateCode formationId={formationId} directorAccounts={[]} allowDirector={false} />
      </Section>

      <Section title={`Équipe (${staff.length})`}>
        <AdminStaffList staff={staff} />
      </Section>

      <Section title={`Joueurs (${players.length})`}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <AdminPlayers players={players as any} quota={quota} />
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
          <AdminCronControls formationId={formationId} />
        </div>
      </Section>
    </div>
  );
}
