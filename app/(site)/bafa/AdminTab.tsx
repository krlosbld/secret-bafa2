import { prisma } from "@/lib/prisma";
import { AdminSecretsPending, AdminSecretsPublished } from "../admin/AdminSecrets";
import AdminBuzzPending from "../admin/AdminBuzzPending";
import AdminPlayers from "../admin/AdminPlayers";

export default async function AdminTab({ formationId }: { formationId: string }) {
  const [pendingSecrets, publishedSecrets, pendingBuzzes, players, quotaConfig] = await Promise.all([
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
    }),
    prisma.config.findUnique({ where: { formationId_key: { formationId, key: "buzzQuota" } } }),
  ]);

  const quota = Number(quotaConfig?.value ?? 3);

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

      <Section title={`Joueurs (${players.length})`}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <AdminPlayers players={players as any} quota={quota} />
      </Section>
    </div>
  );
}
