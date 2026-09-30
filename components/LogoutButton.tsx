"use client";

import { useState } from "react";

// Bouton « Se déconnecter » de la barre du haut : déconnexion complète puis retour à la connexion.
export default function LogoutButton() {
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => {});
    window.location.assign("/login?notice=logged_out");
  }

  return (
    <button type="button" className="nav-link nav-logout" onClick={logout} disabled={loading} aria-label="Se déconnecter" title="Se déconnecter">
      <span className="nav-logout__text">{loading ? "Déconnexion…" : "Se déconnecter"}</span>
      <span className="nav-logout__icon" aria-hidden>
        ⏻
      </span>
    </button>
  );
}
