import { prisma } from "@/lib/prisma";
import { AdminSecretsPending, AdminSecretsPublished } from "../../admin/AdminSecrets";
import AdminBuzzPending from "../../admin/AdminBuzzPending";
import AdminPlayers from "../../admin/AdminPlayers";
import AdminCronControls from "../../admin/AdminCronControls";
import AdminEndGame from "../../admin/AdminEndGame";
import AdminGameRules from "../../admin/AdminGameRules";
import AdminReset from "../../admin/AdminReset";
import { GAME_RULES } from "@/lib/gameRules";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 14px", color: "#0f172a" }}>{title}</h2>
      {children}
    </section>
  );
}

// Administration du Jeu des secrets d'une session (Jeu → « Gestion du jeu ») : réservée au maître du
// jeu désigné (et au super-admin). Réglages, participation des stagiaires, validation ou refus des
// secrets, buzz, joueurs, cron, fin du jeu. Super-admin : en plus, la réinitialisation (canReset).
// canManageIdentity : renommer / supprimer une fiche reste un droit du directeur (et du super-admin).
export default async function GameAdminPanel({
  formationId,
  formationName,
  canReset = false,
  canManageIdentity = false,
}: {
  formationId: string;
  formationName: string;
  canReset?: boolean;
  canManageIdentity?: boolean;
}) {
  const [pendingSecrets, publishedSecrets, pendingBuzzes, players, trainees, quotaConfig, lastNightlyRunConfig, gameEndedConfig, ruleRows, buzzPausedConfig] = await Promise.all([
    prisma.secret.findMany({
      where: { status: "PENDING", formationId },
      orderBy: { createdAt: "asc" },
      include: {
        player: { select: { firstName: true, code: true } },
        foundBy: { select: { firstName: true } },
        _count: { select: { rejections: true } },
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
      where: { formationId, role: "STAGIAIRE", active: true }, // les leurres sont des fiches inactives
      orderBy: { firstName: "asc" },
      select: { firstName: true, gameParticipation: true, secret: { select: { status: true } } },
    }),
    prisma.config.findUnique({ where: { formationId_key: { formationId, key: "buzzQuota" } } }),
    prisma.config.findUnique({ where: { formationId_key: { formationId, key: "lastNightlyRun" } } }),
    prisma.config.findUnique({ where: { formationId_key: { formationId, key: "gameEnded" } } }),
    prisma.config.findMany({ where: { formationId, key: { in: GAME_RULES.map((r) => r.key) } } }),
    prisma.config.findUnique({ where: { formationId_key: { formationId, key: "buzzPaused" } } }),
  ]);

  const participating = trainees.filter((t) => t.gameParticipation === "ACCEPTED");
  const declined = trainees.filter((t) => t.gameParticipation === "DECLINED");
  const undecided = trainees.filter((t) => !t.gameParticipation);
  const withoutSecret = participating.filter((t) => !t.secret || t.secret.status === "REJECTED");

  const quota = Number(quotaConfig?.value ?? 3);
  const gameEnded = gameEndedConfig?.value === "true";
  const buzzPaused = buzzPausedConfig?.value === "true";
  const ruleValues = new Map(ruleRows.map((r) => [r.key, r.value]));
  const initialRules = Object.fromEntries(GAME_RULES.map((r) => [r.key, ruleValues.get(r.key) === "true"]));

  let lastNightlyRun: { at: string; updated: number } | null = null;
  if (lastNightlyRunConfig) {
    try {
      lastNightlyRun = JSON.parse(lastNightlyRunConfig.value);
    } catch {
      lastNightlyRun = null;
    }
  }

  return (
    <div>
      <Section title="Participation des stagiaires">
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
          <div>
            <strong>✅ {participating.length} participe{participating.length > 1 ? "nt" : ""}</strong>
            {participating.length > 0 && <span style={{ color: "#64748b" }}> — {participating.map((t) => t.firstName).join(", ")}</span>}
          </div>
          {withoutSecret.length > 0 && (
            <div style={{ color: "#92400e" }}>
              ✍️ Pas encore de secret (ou secret refusé) : {withoutSecret.map((t) => t.firstName).join(", ")}
            </div>
          )}
          <div>
            <strong>🚫 {declined.length} {declined.length > 1 ? "ont" : "a"} refusé</strong>
            {declined.length > 0 && <span style={{ color: "#64748b" }}> — {declined.map((t) => t.firstName).join(", ")}</span>}
          </div>
          <div>
            <strong>⏳ {undecided.length} sans réponse</strong>
            {undecided.length > 0 && <span style={{ color: "#64748b" }}> — {undecided.map((t) => t.firstName).join(", ")}</span>}
          </div>
        </div>
      </Section>

      <Section title="Fin du jeu">
        <AdminEndGame formationId={formationId} gameEnded={gameEnded} initialBuzzPaused={buzzPaused} />
      </Section>

      <Section title="⚙️ Règles du jeu">
        <AdminGameRules initialRules={initialRules} />
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

      <>
          <Section title={`Joueurs (${players.length})`}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <AdminPlayers players={players as any} quota={quota} canManageIdentity={canManageIdentity} />
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
      </>

      {canReset && (
        <Section title="Réinitialiser le jeu">
          <AdminReset formationId={formationId} formationName={formationName} />
        </Section>
      )}
    </div>
  );
}
