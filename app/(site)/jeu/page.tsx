import { prisma } from "@/lib/prisma";
import { hasNotStartedYet } from "@/lib/formationSession";
import { getGameFormation } from "@/lib/gameFormation";
import { isSecretCurrentlyVisible } from "@/lib/secretVisibility";
import { historyRevealCost } from "@/lib/buzzResolution";
import SessionAccessGate from "@/components/SessionAccessGate";
import FakeSecretAnnouncement from "@/components/FakeSecretAnnouncement";
import SecretsClient from "../SecretsClient";
import { redirect } from "next/navigation";
import { gameClosedForCurrentPlayer, getGameState } from "@/lib/gameAccess";
import { getPlayerSession } from "@/lib/playerAuth";
import MySecretPanel, { type MySecretStatus } from "@/components/MySecretPanel";

export const metadata = { title: "BafaPilot 🤫" };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage({ searchParams }: { searchParams: Promise<{ proposer?: string }> }) {
  const { proposer } = await searchParams;
  // Tout passe par le compte : membre de la session ouverte (ou admin), sinon écran d'accès.
  const formation = await getGameFormation();
  if (!formation) {
    return <SessionAccessGate next="/jeu" title="Secret BAFA 🤫" />;
  }
  if (await gameClosedForCurrentPlayer()) redirect("/bafa");

  // Où en est mon secret (joueur de la session) ; le maître du jeu, lui, n'en propose pas.
  const [state, playerSession] = await Promise.all([getGameState(formation.id), getPlayerSession()]);
  const me = playerSession
    ? await prisma.player.findUnique({ where: { id: playerSession.playerId }, select: { role: true, isGameMaster: true, secret: { select: { status: true } } } })
    : null;
  const myStatus = (me?.secret?.status ?? "NONE") as MySecretStatus;
  const showMySecret = state.launched && !state.ended && !!me && !me.isGameMaster && me.role !== "DIRECTEUR";

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
  // L'auteur n'est envoyé qu'une fois le secret trouvé : sinon n'importe quel joueur le lirait dans
  // les données reçues par son navigateur.
  const secrets = allSecrets.filter(isSecretCurrentlyVisible).map(({ isDecoy, player, ...s }) => ({
    ...s,
    player: s.status === "FOUND" ? player : null,
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
        {!state.launched && (
          <div className="card" style={{ marginBottom: 20, fontWeight: 700, color: "#475569" }}>
            Le Jeu des secrets n&apos;a pas encore été lancé par le directeur de la session.
          </div>
        )}
        {showMySecret && <MySecretPanel status={myStatus} autoOpen={proposer === "1"} />}
        <SecretsClient initial={secrets} historyRevealEnabled={historyRevealEnabled} />
      </div>
    </main>
  );
}
