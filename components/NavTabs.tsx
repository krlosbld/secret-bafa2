"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string; match: (p: string) => boolean };

// Onglets d'un membre de session : Accueil · Mes sessions · Formation · Jeu.
const MEMBER_TABS: Tab[] = [
  { href: "/", label: "Accueil", match: (p) => p === "/" },
  { href: "/sessions", label: "Mes sessions", match: (p) => p.startsWith("/sessions") },
  { href: "/bafa", label: "Formation", match: (p) => p.startsWith("/bafa") },
  { href: "/jeu", label: "Jeu", match: (p) => p.startsWith("/jeu") || p.startsWith("/ranking") },
];

// Onglets du super-admin, qui n'a pas de session : comptes, sessions (formations) et journal.
const ADMIN_TABS: Tab[] = [
  { href: "/", label: "Accueil", match: (p) => p === "/" },
  { href: "/admin", label: "Formations", match: (p) => p === "/admin" || p.startsWith("/admin/formations") },
  { href: "/admin/utilisateurs", label: "Utilisateurs", match: (p) => p.startsWith("/admin/utilisateurs") },
  { href: "/admin/journal", label: "Journal", match: (p) => p.startsWith("/admin/journal") },
];

export default function NavTabs({ variant = "member" }: { variant?: "member" | "admin" }) {
  const pathname = usePathname() ?? "/";
  const tabs = variant === "admin" ? ADMIN_TABS : MEMBER_TABS;
  return (
    <nav className="app-nav__tabs" aria-label="Navigation principale">
      {tabs.map((t) => {
        const active = t.match(pathname);
        return (
          <Link key={t.href} href={t.href} className={`app-nav__tab${active ? " app-nav__tab--active" : ""}`} aria-current={active ? "page" : undefined}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
