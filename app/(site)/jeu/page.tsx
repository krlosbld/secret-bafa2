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
import DirectorGameControls from "./gestion/DirectorGameControls";
import { loadDirectorControls } from "./gestion/directorControls";
import { getSession, isSuperAdmin } from "@/lib/auth";

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

  const [state, playerSession, adminSession] = await Promise.all([getGameState(formation.id), getPlayerSession(), getSession()]);
  const me = playerSession
    ? await prisma.player.findUnique({ where: { id: playerSession.playerId }, select: { id: true, role: true, isGameMaster: true, secret: { select: { status: true } } } })
    : null;
  const isDirector = me?.role === "DIRECTEUR" || isSuperAdmin(adminSession);
  // Bloc du directeur : « Lancer le jeu », puis la seule ligne « Maître du jeu : X · Changer ».
  const directorControls = isDirector ? await loadDirectorControls(formation.id, state, me?.id ?? null) : null;

  // Tant que le jeu n'est pas lancé, l'onglet Jeu ne montre que le lancement (directeur) ou un message.
  if (!state.launched) {
    return (
      <main className="page">
        <div className="container">
          <h1 className="h1">Jeu des secrets 🤫</h1>
          {directorControls ? (
            <DirectorGameControls {...directorControls} />
          ) : (
            <div className="card" style={{ marginTop: 16, fontWeight: 700, color: "#475569" }}>
              Le Jeu des secrets n&apos;a pas encore été lancé par le directeur de la session.
            </div>
          )}
        </div>
      </main>
    );
  }

  // Où en est mon secret : tout joueur (stagiaire, formateur, directeur) sauf le maître du jeu.
  const myStatus = (me?.secret?.status ?? "NONE") as MySecretStatus;
  const showMySecret = !state.ended && !!me && !me.isGameMaster;

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
        {directorControls && <DirectorGameControls {...directorControls} compact />}
        {showMySecret && <MySecretPanel status={myStatus} autoOpen={proposer === "1"} />}
        <SecretsClient initial={secrets} historyRevealEnabled={historyRevealEnabled} />
      </div>
    </main>
  );
}
