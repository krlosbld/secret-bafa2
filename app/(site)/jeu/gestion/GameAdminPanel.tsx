import { prisma } from "@/lib/prisma";
import ParticipantsBoard from "./ParticipantsBoard";
import { loadReadiness } from "@/lib/gameReadiness";
import { getGameStatus } from "@/lib/gameAccess";
import { AdminDecoyCreator, AdminSecretsPending, AdminSecretsPublished } from "../../admin/AdminSecrets";
import AdminBuzzPending from "../../admin/AdminBuzzPending";
import BuzzPendingButton from "../../admin/BuzzPendingButton";
import AdminPlayers from "../../admin/AdminPlayers";
import AdminCronControls from "../../admin/AdminCronControls";
import AdminEndGame from "../../admin/AdminEndGame";
import AdminGameRules from "../../admin/AdminGameRules";
import AdminReset from "../../admin/AdminReset";
import { GAME_RULES } from "@/lib/gameRules";
import { getRuleSettings } from "@/lib/gameRuleSettings";
import AdminPointsLedger from "../../admin/AdminPointsLedger";
import AdminQuestions from "../../admin/AdminQuestions";
import AdminFakeIdentities from "../../admin/AdminFakeIdentities";
import AdminBounties from "../../admin/AdminBounties";
import AdminLeaders from "../../admin/AdminLeaders";

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
  const [pendingSecrets, publishedSecrets, pendingBuzzes, players, quotaConfig, lastNightlyRunConfig, gameEndedConfig, ruleRows, buzzPausedConfig] = await Promise.all([
    prisma.secret.findMany({
      where: { status: "PENDING", formationId },
      orderBy: { createdAt: "asc" },
      include: {
        player: { select: { firstName: true, code: true, fakeVisible: true } },
        foundBy: { select: { firstName: true } },
        _count: { select: { rejections: true } },
      },
    }),
    prisma.secret.findMany({
      where: { status: { in: ["PUBLISHED", "FOUND"] }, formationId },
      orderBy: { createdAt: "desc" },
      include: {
        player: { select: { firstName: true, code: true, fakeVisible: true } },
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
      // Joueurs : les stagiaires qui ont accepté de jouer, et l'équipe qui joue (avec un vrai secret).
      // Pas les stagiaires sans réponse ou qui ont refusé, ni le maître du jeu, ni les faux secrets.
      where: {
        formationId,
        isGameMaster: false,
        NOT: { secret: { is: { isDecoy: true } } },
        OR: [
          { active: true, gameParticipation: "ACCEPTED" }, // stagiaires et équipe qui ont accepté
          { gameParticipation: null, role: { not: "STAGIAIRE" }, secret: { is: { status: { in: ["PUBLISHED", "FOUND"] } } } }, // anciennes parties
        ],
      },
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
    prisma.config.findUnique({ where: { formationId_key: { formationId, key: "buzzQuota" } } }),
    prisma.config.findUnique({ where: { formationId_key: { formationId, key: "lastNightlyRun" } } }),
    prisma.config.findUnique({ where: { formationId_key: { formationId, key: "gameEnded" } } }),
    prisma.config.findMany({ where: { formationId, key: { in: GAME_RULES.map((r) => r.key) } } }),
    prisma.config.findUnique({ where: { formationId_key: { formationId, key: "buzzPaused" } } }),
  ]);

  const [readiness, status] = await Promise.all([loadReadiness(formationId), getGameStatus(formationId)]);

  const quota = Number(quotaConfig?.value ?? 3);
  const gameEnded = gameEndedConfig?.value === "true";
  const buzzPaused = buzzPausedConfig?.value === "true";
  const ruleValues = new Map(ruleRows.map((r) => [r.key, r.value]));
  const ruleSettings = await getRuleSettings(formationId);
  const questionCount = await prisma.secretQuestion.count({ where: { formationId } });
  const fakeIdentityCount = await prisma.gamePower.count({ where: { formationId, kind: "FAKE_IDENTITY" } });
  const bountyCount = await prisma.gamePower.count({ where: { formationId, kind: "BOUNTY" } });
  const leaderCount = await prisma.leaderDay.count({ where: { formationId } });
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
      <Section title="Faux secrets">
        <AdminDecoyCreator />
      </Section>

      {(ruleSettings.enabled["rule_fakeIdentity"] || fakeIdentityCount > 0) && (
        <Section title="🎭 Fausses identités">
          <AdminFakeIdentities />
        </Section>
      )}

      {(ruleSettings.enabled["rule_bounty"] || bountyCount > 0) && (
        <Section title="🎯 Secrets mis à prix">
          <AdminBounties />
        </Section>
      )}

      {(ruleSettings.enabled["rule_leaderPrivilege"] || leaderCount > 0) && (
        <Section title="👑 Leaders du jour">
          <AdminLeaders />
        </Section>
      )}

      {(ruleSettings.enabled["rule_mysteryBuzz"] || ruleSettings.enabled["rule_leaderPrivilege"] || questionCount > 0) && (
        <Section title="❓ Questions des joueurs">
          <AdminQuestions />
        </Section>
      )}

      {/* Participants : utiles pendant les inscriptions (démarrage de la partie), masqués ensuite. */}
      {(status === "inscriptions_ouvertes" || status === "non_configure") && (
        <Section title="Participants et démarrage de la partie">
          <ParticipantsBoard status="inscriptions_ouvertes" participants={readiness.participants} />
        </Section>
      )}

      {status !== "inscriptions_ouvertes" && (
        <Section title="Fin du jeu">
          <AdminEndGame formationId={formationId} gameEnded={gameEnded} initialBuzzPaused={buzzPaused} pendingBuzzes={pendingBuzzes.length} />
        </Section>
      )}

      <Section title="⚙️ Règles du jeu">
        <AdminGameRules initialRules={initialRules} initialParams={ruleSettings.params} />
      </Section>

      <section style={{ marginBottom: 40 }}>
        <BuzzPendingButton count={pendingBuzzes.length}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <AdminBuzzPending buzzes={pendingBuzzes as any} />
        </BuzzPendingButton>
      </section>

      <Section title={`Secrets en attente (${pendingSecrets.length})`}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <AdminSecretsPending secrets={pendingSecrets as any} />
      </Section>

      <Section title={`Secrets validés (${publishedSecrets.length})`}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <AdminSecretsPublished secrets={publishedSecrets as any} />
      </Section>

      <>
          <Section title="📒 Journal des points">
            <AdminPointsLedger players={players.map((p: { id: string; firstName: string }) => ({ id: p.id, firstName: p.firstName }))} />
          </Section>

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
