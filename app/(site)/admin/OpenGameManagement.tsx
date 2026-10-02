"use client";

import { useState } from "react";

// Ouvre la gestion du jeu (onglet Jeu) sur CETTE session : on la choisit d'abord comme session de travail.
export default function OpenGameManagement({ formationId }: { formationId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/select-formation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formationId }),
    }).catch(() => null);
    if (res?.ok) {
      window.location.assign("/jeu/gestion");
      return;
    }
    setLoading(false);
    setError("Impossible d'ouvrir la gestion du jeu.");
  }

  return (
    <div>
      <button type="button" className="btn btn-main" onClick={open} disabled={loading}>
        {loading ? "Ouverture…" : "🤫 Gérer le jeu de cette session"}
      </button>
      {error && <p style={{ color: "#dc2626", margin: "6px 0 0", fontSize: 13 }}>{error}</p>}
    </div>
  );
}
