import { randomInt } from "crypto";
import { prisma } from "@/lib/prisma";
import { hasNotStartedYet } from "@/lib/formationSession";
import { getGameFormation } from "@/lib/gameFormation";
import { isSecretCurrentlyVisible } from "@/lib/secretVisibility";
import { historyRevealCost } from "@/lib/buzzResolution";
import SessionAccessGate from "@/components/SessionAccessGate";
import FakeSecretAnnouncement from "@/components/FakeSecretAnnouncement";
import SecretsClient from "../SecretsClient";
import { redirect } from "next/navigation";
import { currentActivePlayer, gameClosedForCurrentPlayer, getGameState, PROPOSAL_DELAY_MS } from "@/lib/gameAccess";
import { getPlayerSession } from "@/lib/playerAuth";
import MySecretPanel, { type MySecretStatus } from "@/components/MySecretPanel";
import MyPowers from "@/components/MyPowers";
import { getMysteryState } from "@/lib/mysteryBuzz";
import { getFakeIdentityState } from "@/lib/fakeIdentity";
import { getBountyState } from "@/lib/bounty";
import DirectorGameControls from "./gestion/DirectorGameControls";
import { loadDirectorControls } from "./gestion/directorControls";
import { getSession, isSuperAdmin } from "@/lib/auth";

export const metadata = { title: "BafaPilot 🤫" };

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PHASE_TEXT = {
  inscriptions_ouvertes: "Inscriptions en cours : les secrets seront visibles et les buzz ouverts quand le maître du jeu commencera la partie.",
  en_cours: "Lis les secrets et devine à qui ils appartiennent. Buzze pour tenter ta chance !",
  termine: "La partie est terminée : voici les résultats définitifs et les auteurs des secrets.",
} as const;

// Onglet Jeu, selon la phase :
// - non configuré : le directeur voit « Lancer le jeu », les autres un message ;
// - inscriptions : le participant suit sa proposition de secret ; aucun secret n'est visible ;
// - en cours : secrets validés visibles (sans auteur), buzz pour les participants ;
// - terminé : résultats, auteurs révélés.
export default async function HomePage({ searchParams }: { searchParams: Promise<{ proposer?: string }> }) {
  const { proposer } = await searchParams;
  const formation = await getGameFormation();
  if (!formation) {
    return <SessionAccessGate next="/jeu" title="Secret BAFA 🤫" />;
  }
  if (await gameClosedForCurrentPlayer()) redirect("/bafa");

  const [state, playerSession, adminSession, active] = await Promise.all([
    getGameState(formation.id),
    getPlayerSession(),
    getSession(),
    currentActivePlayer(),
  ]);
  const me = playerSession
    ? await prisma.player.findUnique({ where: { id: playerSession.playerId }, select: { id: true, role: true, isGameMaster: true } })
    : null;
  const isDirector = me?.role === "DIRECTEUR" || isSuperAdmin(adminSession);
  const directorControls = isDirector ? await loadDirectorControls(formation.id, state, me?.id ?? null) : null;

  if (state.status === "non_configure") {
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

  // Ma proposition (participant) : statut, délai de 24 h, motif du dernier refus.
  let mySecret: { status: MySecretStatus; deadline: string | null; reason: string | null } | null = null;
  if (active) {
    const row = await prisma.player.findUnique({
      where: { id: active.id },
      select: {
        gameParticipationAt: true,
        secret: { select: { status: true, rejections: { orderBy: { rejectedAt: "desc" }, take: 1, select: { reason: true } } } },
      },
    });
    mySecret = {
      status: (row?.secret?.status ?? "NONE") as MySecretStatus,
      deadline: !row?.secret && row?.gameParticipationAt ? new Date(row.gameParticipationAt.getTime() + PROPOSAL_DELAY_MS).toISOString() : null,
      reason: row?.secret?.status === "REJECTED" ? row.secret.rejections[0]?.reason ?? null : null,
    };
  }

  // Mes pouvoirs (Buzz mystère) : les données du joueur connecté seulement.
  const mystery = active ? await getMysteryState(formation.id, active.id) : null;
  const bounty = active ? await getBountyState(formation.id, active.id) : null; // règle d'abord une mise échue
  const fakeIdentity = active ? await getFakeIdentityState(formation.id, active.id) : null;
  const myOwnSecretId = mystery?.available ? (await prisma.secret.findUnique({ where: { playerId: active!.id }, select: { id: true } }))?.id ?? null : null;

  const showSecrets = state.status === "en_cours" || state.status === "termine";
  const [allSecrets, historyRevealConfig] = showSecrets
    ? await Promise.all([
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
      ])
    : [[], null];
  const historyRevealEnabled = historyRevealConfig?.value === "true";
  // isDecoy ne doit jamais atteindre le client (ça révélerait quels secrets sont faux) — on ne
  // garde que le coût déjà calculé pour la révélation payante. L'auteur n'est envoyé qu'une fois le
  // secret trouvé, ou quand la partie est terminée.
  const secrets = allSecrets.filter(isSecretCurrentlyVisible).map(({ isDecoy, player, ...s }) => ({
    ...s,
    player: s.status === "FOUND" || state.status === "termine" ? (isDecoy ? { firstName: "🎭 faux secret" } : player) : null,
    revealCost: historyRevealCost({ bonus: s.bonus, isDecoy }),
  }));

  return (
    <main className="page">
      {state.status === "en_cours" && <FakeSecretAnnouncement />}
      <div className="container">
        <h1 className="h1">BafaPilot 🤫</h1>
        <p className="sub">{PHASE_TEXT[state.status]}</p>
        {!formation.active && state.status === "en_cours" && (
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
        {mystery && fakeIdentity && bounty && (mystery.enabled || mystery.questions.length > 0 || fakeIdentity.enabled || fakeIdentity.used || bounty.enabled || bounty.used) && (
          <MyPowers initial={{ mystery, fakeIdentity, bounty }} />
        )}
        {mySecret && state.status !== "termine" && (
          <MySecretPanel
            status={mySecret.status}
            phase={state.status}
            deadline={mySecret.deadline}
            reason={mySecret.reason}
            autoOpen={proposer === "1"}
          />
        )}
        {state.status === "inscriptions_ouvertes" && !mySecret && (
          <div className="card" style={{ fontWeight: 700, color: "#475569" }}>
            {me?.isGameMaster
              ? "Inscriptions en cours : suis les participants et valide leurs secrets dans « Gestion du jeu »."
              : "Inscriptions en cours : la partie n'a pas encore commencé."}
          </div>
        )}
        {showSecrets && (
          <SecretsClient
            initial={secrets}
            historyRevealEnabled={historyRevealEnabled}
            canPlay={!!active && state.status === "en_cours"}
            shuffleSeed={randomInt(2 ** 31)}
            mysteryAvailable={!!mystery?.available}
            mySecretId={myOwnSecretId}
          />
        )}
      </div>
    </main>
  );
}
