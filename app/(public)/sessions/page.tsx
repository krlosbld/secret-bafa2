import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getVerifiedUser } from "@/lib/userSession";
import { getSession } from "@/lib/auth";
import { getPlayerSession } from "@/lib/playerAuth";
import { getMySessionCards, toCards, openSessionPath, type SessionCard } from "@/lib/mySessions";

export const metadata = { title: "Ma session — BafaPilot" };
export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = { DIRECTEUR: "Directeur", FORMATEUR: "Formateur", STAGIAIRE: "Stagiaire" };

function Card({ s, href }: { s: SessionCard; href: string }) {
  return (
    <article className={`bp-session${s.archived ? " bp-session--archived" : ""}`}>
      <div className="bp-session__body">
        <p className="bp-session__type">{s.typeLabel}</p>
        <h3 className="bp-session__name">{s.name}</h3>
        <p className="bp-session__meta">
          {s.location && (
            <>
              {s.location}
              <br />
            </>
          )}
          {s.dates}
        </p>
        <p className="bp-session__role">Rôle : {ROLE_LABELS[s.role] ?? s.role}</p>
        {s.gameCode && <p className="bp-session__meta" style={{ margin: "6px 0 0" }}>Ton code perso pour le jeu : <strong>{s.gameCode}</strong></p>}
      </div>
      <Link href={href} className={`bp-btn ${s.archived ? "bp-btn--outline" : "bp-btn--primary"} bp-session__open`}>
        Ouvrir
      </Link>
    </article>
  );
}

function Group({ title, cards, hrefOf, empty }: { title: string; cards: SessionCard[]; hrefOf: (s: SessionCard) => string; empty: string }) {
  return (
    <section className="bp-sessions__group">
      <h2 className="bp-sessions__title">
        {title} <span className="bp-sessions__count">{cards.length}</span>
      </h2>
      {cards.length === 0 ? (
        <p className="bp-sessions__empty">{empty}</p>
      ) : (
        <div className="bp-sessions__grid">
          {cards.map((s) => (
            <Card key={s.formationId} s={s} href={hrefOf(s)} />
          ))}
        </div>
      )}
    </section>
  );
}

export default async function SessionsPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams;
  const user = await getVerifiedUser();

  let cards: SessionCard[];
  let hrefOf: (s: SessionCard) => string;
  let greeting: string | null = null;

  if (user) {
    cards = await getMySessionCards(user.id);
    hrefOf = (s) => openSessionPath(s.formationId);
    greeting = user.firstName;
  } else {
    // Sans compte : stagiaire ou formateur connecté par code — sa session est celle de sa fiche.
    const playerSession = await getPlayerSession();
    const player = playerSession
      ? await prisma.player.findUnique({
          where: { id: playerSession.playerId },
          select: { firstName: true, role: true, formation: { select: { id: true, name: true, location: true, startDate: true, endDate: true, active: true } } },
        })
      : null;
    if (player) {
      cards = await toCards([{ formation: player.formation, role: player.role }]);
      hrefOf = () => "/bafa";
      greeting = player.firstName;
    } else if (await getSession()) {
      return (
        <div className="bp-auth" style={{ maxWidth: 560 }}>
          <h1 className="bp-auth__title">Ma session</h1>
          <div className="bp-card bp-status">
            <p className="bp-status__text" style={{ margin: 0 }}>
              Vous êtes connecté en administrateur. Les sessions se gèrent depuis{" "}
              <Link href="/admin" className="bp-link">
                l&apos;Administration
              </Link>
              .
            </p>
          </div>
        </div>
      );
    } else {
      redirect("/login?next=/sessions");
    }
  }

  const current = cards.filter((s) => !s.archived).sort((a, b) => a.sortKey - b.sortKey);
  const archived = cards.filter((s) => s.archived).sort((a, b) => b.sortKey - a.sortKey);

  return (
    <div className="bp-sessions">
      <h1 className="bp-auth__title">Ma session</h1>
      {greeting && <p className="bp-auth__sub">Bonjour {greeting} !</p>}

      {erreur === "acces" && (
        <div className="bp-alert bp-alert--error" role="alert" style={{ maxWidth: 560, margin: "0 auto 20px" }}>
          Vous n&apos;êtes pas rattaché à cette session.
        </div>
      )}

      {cards.length === 0 ? (
        <div className="bp-card bp-status" style={{ maxWidth: 560, margin: "0 auto" }}>
          <p className="bp-status__text" style={{ marginBottom: 6 }}>
            <strong>Aucune session ne vous est encore attribuée.</strong>
          </p>
          <p className="bp-status__text" style={{ fontSize: "0.9rem", marginBottom: 0 }}>
            Un responsable ou gestionnaire doit vous rattacher à une session.
          </p>
        </div>
      ) : (
        <>
          <Group title="En cours et à venir" cards={current} hrefOf={hrefOf} empty="Aucune session en cours ni à venir." />
          <Group title="Archives" cards={archived} hrefOf={hrefOf} empty="Aucune session archivée." />
        </>
      )}
    </div>
  );
}
