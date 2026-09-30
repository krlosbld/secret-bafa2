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
    <button type="button" className="app-nav__action app-nav__logout" onClick={logout} disabled={loading} aria-label="Se déconnecter" title="Se déconnecter">
      <span className="app-nav__logout-text">{loading ? "Déconnexion…" : "Se déconnecter"}</span>
      <span className="app-nav__logout-icon" aria-hidden>
        ⏻
      </span>
    </button>
  );
}
