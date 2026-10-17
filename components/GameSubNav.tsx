"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import NavSubmitButton from "@/components/NavSubmitButton";

// Sous-barre de l'onglet Jeu (Secret BAFA) : Secrets · Classement · Gestion du jeu (maître du jeu).
// Rien tant que le jeu n'est pas lancé : l'onglet Jeu ne montre alors que « Lancer le jeu ».
export default function GameSubNav({
  launched = false,
  showRanking = false,
  canManage = false,
  canPropose = false,
}: {
  launched?: boolean;
  showRanking?: boolean; // dès que la partie a commencé
  canManage?: boolean;
  canPropose?: boolean;
}) {
  const pathname = usePathname() ?? "";
  const onManage = pathname.startsWith("/jeu/gestion");
  const onSecrets = pathname.startsWith("/jeu") && !onManage;
  const onRanking = pathname.startsWith("/ranking");
  if (!launched || (!onSecrets && !onRanking && !onManage)) return null;

  return (
    <div className="game-subnav">
      <div className="game-subnav__inner">
        <span className="game-subnav__title">Secret BAFA 🤫</span>
        <div className="game-subnav__links">
          <Link href="/jeu" className={`game-subnav__link${onSecrets ? " game-subnav__link--active" : ""}`}>
            Secrets
          </Link>
          {showRanking && (
            <Link href="/ranking" className={`game-subnav__link${onRanking ? " game-subnav__link--active" : ""}`}>
              Classement
            </Link>
          )}
          {canManage && (
            <Link href="/jeu/gestion" className={`game-subnav__link${onManage ? " game-subnav__link--active" : ""}`}>
              ⚙️ Gestion du jeu
            </Link>
          )}
          {canPropose && <NavSubmitButton />}
        </div>
      </div>
    </div>
  );
}
