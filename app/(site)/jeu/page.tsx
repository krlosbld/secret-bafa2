import { prisma } from "@/lib/prisma";
import { getFormationFromCookie, hasNotStartedYet } from "@/lib/formationSession";
import { isSecretCurrentlyVisible } from "@/lib/secretVisibility";
import { historyRevealCost } from "@/lib/buzzResolution";
import SessionAccessGate from "@/components/SessionAccessGate";
import { getPlayerSession } from "@/lib/playerAuth";
import { getSession } from "@/lib/auth";
import FakeSecretAnnouncement from "@/components/FakeSecretAnnouncement";
import SecretsClient from "../SecretsClient";

export const metadata = { title: "BafaPilot 🤫" };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  // Tout passe par le compte : membre de la session ouverte (ou admin), sinon écran d'accès.
  const formation = await getFormationFromCookie();
  const allowed = formation && ((await getPlayerSession()) || (await getSession()));
  if (!formation || !allowed) {
    return <SessionAccessGate next="/jeu" title="Secret BAFA 🤫" />;
  }

  const [allSecrets, historyRevealConfig] = await Promise.all([
    prisma.secret.findMany({
      where: { status: { in: ["PUBLISHED", "FOUND"] }, formationId: formation.id },
      select: {
        id: true,
        content: true,
        status: true,
        bonus: true,
        isDecoy: true,
        limitedVisibility: true,
        limitedVisibilitySince: true,
        limitedVisibilityMinutes: true,
        player: { select: { firstName: true } },
        foundBy: { select: { firstName: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.config.findUnique({ where: { formationId_key: { formationId: formation.id, key: "rule_paidSecretHistory" } } }),
  ]);
  const historyRevealEnabled = historyRevealConfig?.value === "true";
  // isDecoy ne doit jamais atteindre le client (ça révélerait quels secrets sont faux) — on ne
  // garde que le coût déjà calculé pour la révélation payante.
  const secrets = allSecrets.filter(isSecretCurrentlyVisible).map(({ isDecoy, ...s }) => ({
    ...s,
    revealCost: historyRevealCost({ bonus: s.bonus, isDecoy }),
  }));

  return (
    <main className="page">
      <FakeSecretAnnouncement />
      <div className="container">
        <h1 className="h1">BafaPilot 🤫</h1>
        <p className="sub">
          Lis les secrets et devine à qui ils appartiennent. Buzze pour tenter ta chance !
        </p>
        {!formation.active && (
          <div
            style={{
              background: "#fffbeb",
              border: "1px solid #fde68a",
              borderRadius: 10,
              padding: 12,
              marginBottom: 20,
              color: "#92400e",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {hasNotStartedYet(formation)
              ? "Cette formation n'a pas encore commencé — reviens à la date de début."
              : "Cette formation est terminée — lecture seule, plus de nouveaux secrets ni de buzz possibles."}
          </div>
        )}
        <SecretsClient initial={secrets} historyRevealEnabled={historyRevealEnabled} />
      </div>
    </main>
  );
}
