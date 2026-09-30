import Link from "next/link";
import { getVerifiedUser } from "@/lib/userSession";

export const metadata = {
  title: "BafaPilot — Pilotez vos sessions BAFA simplement",
  description: "Suivi des stagiaires, évaluations, planning et outils de session réunis dans un même espace.",
};

const FEATURES = [
  {
    title: "Suivi des stagiaires",
    text: "Une fiche par stagiaire, les remarques du jour et les entretiens au même endroit.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
        <circle cx="17" cy="9" r="2.4" />
        <path d="M16 14.2c2.3.2 3.9 1.8 4.4 4.3" />
      </svg>
    ),
  },
  {
    title: "Évaluations",
    text: "Des critères partagés par l'équipe pour suivre la progression, jour après jour.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden>
        <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
        <path d="M8.5 9.5l1.8 1.8 3.4-3.6M8.5 15.5h7" />
      </svg>
    ),
  },
  {
    title: "Planning",
    text: "Les créneaux de la session, les responsables et le décompte des heures de formation.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden>
        <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
      </svg>
    ),
  },
  {
    title: "Organisation de la session",
    text: "Une équipe, des rôles clairs et tous les outils de la session réunis.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M12 3.5l7.5 4.2v8.6L12 20.5l-7.5-4.2V7.7z" />
        <path d="M12 12l7.5-4.3M12 12v8.5M12 12L4.5 7.7" />
      </svg>
    ),
  },
];

export default async function HomePage() {
  const user = await getVerifiedUser();

  return (
    <div className="bp-home">
      <section className="bp-hero">
        <p className="bp-hero__eyebrow">BafaPilot</p>
        <h1 className="bp-hero__title">Pilotez vos sessions BAFA simplement.</h1>
        <p className="bp-hero__sub">Suivi des stagiaires, évaluations, planning et outils de session réunis dans un même espace.</p>
        <div className="bp-hero__actions">
          {user ? (
            <Link href="/sessions" className="bp-btn bp-btn--primary bp-btn--lg">
              Mes sessions
            </Link>
          ) : (
            <>
              <Link href="/login" className="bp-btn bp-btn--primary bp-btn--lg">
                Se connecter
              </Link>
              <Link href="/register" className="bp-btn bp-btn--outline bp-btn--lg">
                Créer mon compte
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="bp-features" aria-label="Ce que BafaPilot réunit">
        {FEATURES.map((f) => (
          <article key={f.title} className="bp-feature">
            <div className="bp-feature__icon">{f.icon}</div>
            <h2 className="bp-feature__title">{f.title}</h2>
            <p className="bp-feature__text">{f.text}</p>
          </article>
        ))}
      </section>

      <p className="bp-trainee">
        Vous êtes stagiaire ? Avec le code donné par votre équipe :{" "}
        <Link href="/bafa" className="bp-link">
          Espace stagiaire
        </Link>
        {" · "}
        <Link href="/jeu" className="bp-link">
          Jeu des secrets
        </Link>
      </p>
    </div>
  );
}
