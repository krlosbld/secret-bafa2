"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Les 4 onglets principaux de BafaPilot, identiques sur tout le site.
const TABS = [
  { href: "/", label: "Accueil", match: (p: string) => p === "/" },
  { href: "/sessions", label: "Ma session", match: (p: string) => p.startsWith("/sessions") },
  { href: "/bafa", label: "Formation", match: (p: string) => p.startsWith("/bafa") },
  { href: "/jeu", label: "Jeu", match: (p: string) => p.startsWith("/jeu") || p.startsWith("/ranking") },
];

export default function NavTabs() {
  const pathname = usePathname() ?? "/";
  return (
    <nav className="app-nav__tabs" aria-label="Navigation principale">
      {TABS.map((t) => {
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
