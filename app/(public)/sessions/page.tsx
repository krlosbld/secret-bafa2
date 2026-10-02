import Link from "next/link";
import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/userSession";
import { getSession } from "@/lib/auth";
import { getMySessionCards, openSessionPath, type SessionCard } from "@/lib/mySessions";

export const metadata = { title: "Mes sessions — BafaPilot" };
export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = { DIRECTEUR: "Directeur", FORMATEUR: "Formateur", STAGIAIRE: "Stagiaire" };
const STATUS_LABELS: Record<SessionCard["status"], string> = { "en-cours": "Session en cours", "a-venir": "Session à venir", archive: "Archivée" };

// Icônes au trait (style Lucide), héritent de la couleur du texte.
function Icon({ name, size = 18 }: { name: "calendar" | "user" | "pin" | "cap" | "archive" | "qr" | "chevron" | "arrow"; size?: number }) {
  const paths: Record<typeof name, React.ReactNode> = {
    calendar: (
      <>
        <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
        <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 21c.8-4 3.8-6 7.5-6s6.7 2 7.5 6" />
      </>
    ),
    pin: (
      <>
        <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
        <circle cx="12" cy="9.5" r="2.5" />
      </>
    ),
    cap: (
      <>
        <path d="M2 9.5 12 5l10 4.5-10 4.5L2 9.5z" />
        <path d="M6 11.5V16c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.5M22 9.5V15" />
      </>
    ),
    archive: (
      <>
        <rect x="2.5" y="3.5" width="19" height="5" rx="1.5" />
        <path d="M4.5 8.5V19a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V8.5M10 12.5h4" />
      </>
    ),
    qr: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" />
      </>
    ),
    chevron: <path d="m9 6 6 6-6 6" />,
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths[name]}
    </svg>
  );
}

// Session en cours ou à venir : grande carte horizontale pleine largeur.
function CurrentCard({ s, href }: { s: SessionCard; href: string }) {
  return (
    <article className="bp-scard">
      <div className="bp-scard__id">
        <span className="bp-sicon bp-sicon--lg" aria-hidden>
          <Icon name="cap" size={26} />
        </span>
        <div className="bp-scard__titles">
          <p className="bp-scard__type">{s.typeShort}</p>
          <h3 className="bp-scard__name">{s.name}</h3>
          {s.category && <p className="bp-scard__category">{s.category}</p>}
          <span className={`bp-sbadge bp-sbadge--${s.status}`}>{STATUS_LABELS[s.status]}</span>
        </div>
      </div>
      <dl className="bp-scard__facts">
        <div className="bp-fact">
          <Icon name="calendar" />
          <div>
            <dt>Dates</dt>
            <dd>{s.dates}</dd>
          </div>
        </div>
        <div className="bp-fact">
          <Icon name="user" />
          <div>
            <dt>Rôle</dt>
            <dd className="bp-fact__strong">{ROLE_LABELS[s.role] ?? s.role}</dd>
          </div>
        </div>
        <div className="bp-fact">
          <Icon name="pin" />
          <div>
            <dt>Lieu</dt>
            <dd>{s.location || "–"}</dd>
          </div>
        </div>
      </dl>
      <Link href={href} className="bp-btn bp-btn--primary bp-scard__open">
        Ouvrir la session <Icon name="arrow" />
      </Link>
    </article>
  );
}

// Session archivée : carte compacte, en grille de deux colonnes sur grand écran.
function ArchiveCard({ s, href }: { s: SessionCard; href: string }) {
  return (
    <article className={`bp-acard bp-acard--${s.typeKey.toLowerCase()}`}>
      <span className="bp-sicon" aria-hidden>
        <Icon name="cap" size={22} />
      </span>
      <div className="bp-acard__body">
        <p className="bp-acard__type">{s.typeShort}</p>
        <h3 className="bp-acard__name">{s.name}</h3>
        {s.category && <p className="bp-acard__category">{s.category}</p>}
        <p className="bp-acard__meta">
          <span>
            <Icon name="calendar" size={16} />
            {s.dates}
          </span>
          <span>
            <Icon name="user" size={16} />
            <strong>{ROLE_LABELS[s.role] ?? s.role}</strong>
          </span>
        </p>
      </div>
      <Link href={href} className="bp-acard__open" aria-label={`Ouvrir ${s.name}`}>
        <Icon name="chevron" />
      </Link>
    </article>
  );
}

function SectionTitle({ icon, title, count }: { icon: "calendar" | "archive"; title: string; count: number }) {
  return (
    <h2 className="bp-sessions__title">
      <span className="bp-sessions__ticon">
        <Icon name={icon} size={22} />
      </span>
      {title} <span className={`bp-sessions__count${icon === "archive" ? " bp-sessions__count--muted" : ""}`}>{count}</span>
    </h2>
  );
}

export default async function SessionsPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams;
  const user = await getVerifiedUser();

  let cards: SessionCard[];
  let hrefOf: (s: SessionCard) => string;

  if (user?.platformRole === "SUPERADMIN" && !user.impersonatorId) redirect("/admin");
  if (user) {
    cards = await getMySessionCards(user.id);
    hrefOf = (s) => openSessionPath(s.formationId);
  } else if (await getSession()) {
    return (
      <div className="bp-auth" style={{ maxWidth: 560 }}>
        <h1 className="bp-auth__title">Mes sessions</h1>
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

  const current = cards.filter((s) => !s.archived).sort((a, b) => a.sortKey - b.sortKey);
  const archived = cards.filter((s) => s.archived).sort((a, b) => b.sortKey - a.sortKey);

  return (
    <div className="bp-sessions">
      <header className="bp-sessions__head">
        <div>
          <h1 className="bp-sessions__h1">Mes sessions</h1>
          <p className="bp-sessions__lead">Retrouvez ici les sessions qui vous sont attribuées.</p>
        </div>
        <aside className="bp-join">
          <span className="bp-join__icon">
            <Icon name="qr" size={30} />
          </span>
          <div>
            <p className="bp-join__title">Pour rejoindre une autre session</p>
            <p className="bp-join__text">Scannez le QR code ou ouvrez le lien d&apos;invitation fourni par le directeur.</p>
          </div>
        </aside>
      </header>

      {erreur === "acces" && (
        <div className="bp-alert bp-alert--error" role="alert" style={{ marginBottom: 24 }}>
          Vous n&apos;êtes pas rattaché à cette session.
        </div>
      )}

      {cards.length === 0 ? (
        <div className="bp-card bp-status" style={{ maxWidth: 560 }}>
          <p className="bp-status__text" style={{ marginBottom: 6 }}>
            <strong>Aucune session ne vous est encore attribuée.</strong>
          </p>
          <p className="bp-status__text" style={{ fontSize: "0.9rem", marginBottom: 0 }}>
            Stagiaire : scannez le QR code de votre session pour la rejoindre.
            <br />
            Équipe : un responsable ou gestionnaire doit vous rattacher à une session.
          </p>
        </div>
      ) : (
        <>
          <section className="bp-sessions__group">
            <SectionTitle icon="calendar" title="En cours et à venir" count={current.length} />
            {current.length === 0 ? (
              <p className="bp-sessions__empty">Aucune session en cours ni à venir.</p>
            ) : (
              <div className="bp-sessions__list">
                {current.map((s) => (
                  <CurrentCard key={s.formationId} s={s} href={hrefOf(s)} />
                ))}
              </div>
            )}
          </section>

          <section className="bp-sessions__group">
            <SectionTitle icon="archive" title="Archives" count={archived.length} />
            {archived.length === 0 ? (
              <p className="bp-sessions__empty">Aucune session archivée.</p>
            ) : (
              <div className="bp-sessions__grid">
                {archived.map((s) => (
                  <ArchiveCard key={s.formationId} s={s} href={hrefOf(s)} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
