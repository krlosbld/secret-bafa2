"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type Tab = { href: string; label: string; match: (p: string, tab: string | null) => boolean };
type Variant = "member" | "admin" | "trainee";
type Props = { variant?: Variant; manySessions?: boolean };

// Onglets d'un membre de session : Accueil · Mes sessions · Formation · Jeu.
const MEMBER_TABS: Tab[] = [
  { href: "/", label: "Accueil", match: (p) => p === "/" },
  { href: "/sessions", label: "Mes sessions", match: (p) => p.startsWith("/sessions") },
  { href: "/bafa", label: "Formation", match: (p) => p.startsWith("/bafa") },
  { href: "/jeu", label: "Jeu", match: (p) => p.startsWith("/jeu") || p.startsWith("/ranking") },
];

// Onglets d'un stagiaire : son accueil (programme du jour, dernière évaluation), le planning
// complet, sa fiche et le jeu.
const TRAINEE_TABS: Tab[] = [
  { href: "/bafa", label: "Accueil", match: (p, tab) => p === "/bafa" && tab !== "planning" && tab !== "fiche" },
  { href: "/bafa?tab=planning", label: "Planning", match: (p, tab) => p === "/bafa" && tab === "planning" },
  { href: "/bafa?tab=fiche", label: "Ma formation", match: (p, tab) => p === "/bafa" && tab === "fiche" },
  { href: "/jeu", label: "Jeu", match: (p) => p.startsWith("/jeu") || p.startsWith("/ranking") },
];
const SESSIONS_TAB: Tab = { href: "/sessions", label: "Mes sessions", match: (p) => p.startsWith("/sessions") };

// Onglets du super-admin, qui n'a pas de session : comptes, sessions (formations) et journal.
const ADMIN_TABS: Tab[] = [
  { href: "/", label: "Accueil", match: (p) => p === "/" },
  { href: "/admin", label: "Formations", match: (p) => p === "/admin" || p.startsWith("/admin/formations") },
  { href: "/admin/utilisateurs", label: "Utilisateurs", match: (p) => p.startsWith("/admin/utilisateurs") },
  { href: "/admin/journal", label: "Journal", match: (p) => p.startsWith("/admin/journal") },
];

function tabsFor(variant: Variant, manySessions: boolean): Tab[] {
  if (variant === "admin") return ADMIN_TABS;
  if (variant === "trainee") return manySessions ? [...TRAINEE_TABS, SESSIONS_TAB] : TRAINEE_TABS;
  return MEMBER_TABS;
}

function TabList({ tabs, tabParam }: { tabs: Tab[]; tabParam: string | null }) {
  const pathname = usePathname() ?? "/";
  return (
    <nav className="app-nav__tabs" aria-label="Navigation principale">
      {tabs.map((t) => {
        const active = t.match(pathname, tabParam);
        return (
          <Link key={t.href} href={t.href} className={`app-nav__tab${active ? " app-nav__tab--active" : ""}`} aria-current={active ? "page" : undefined}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

// Lit ?tab= (onglets du stagiaire) : à placer dans un <Suspense>, avec NavTabsStatic en secours.
export default function NavTabs({ variant = "member", manySessions = false }: Props) {
  const tabParam = useSearchParams().get("tab");
  return <TabList tabs={tabsFor(variant, manySessions)} tabParam={tabParam} />;
}

export function NavTabsStatic({ variant = "member", manySessions = false }: Props) {
  return <TabList tabs={tabsFor(variant, manySessions)} tabParam={null} />;
}
