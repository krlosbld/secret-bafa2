"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import NavSubmitButton from "@/components/NavSubmitButton";

// Sous-barre de l'onglet Jeu (Secret BAFA) : tout ce qui concerne le jeu des secrets, et seulement là.
export default function GameSubNav({ canManage = false }: { canManage?: boolean }) {
  const pathname = usePathname() ?? "";
  const onManage = pathname.startsWith("/jeu/gestion");
  const onSecrets = pathname.startsWith("/jeu") && !onManage;
  const onRanking = pathname.startsWith("/ranking");
  if (!onSecrets && !onRanking && !onManage) return null;

  return (
    <div className="game-subnav">
      <div className="game-subnav__inner">
        <span className="game-subnav__title">Secret BAFA 🤫</span>
        <div className="game-subnav__links">
          <Link href="/jeu" className={`game-subnav__link${onSecrets ? " game-subnav__link--active" : ""}`}>
            Secrets
          </Link>
          <Link href="/ranking" className={`game-subnav__link${onRanking ? " game-subnav__link--active" : ""}`}>
            Classement
          </Link>
          {canManage && (
            <Link href="/jeu/gestion" className={`game-subnav__link${onManage ? " game-subnav__link--active" : ""}`}>
              ⚙️ Gestion du jeu
            </Link>
          )}
          <NavSubmitButton />
        </div>
      </div>
    </div>
  );
}
