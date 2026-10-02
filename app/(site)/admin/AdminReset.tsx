"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminReset({ formationId, formationName }: { formationId: string; formationName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function reset() {
    if (!confirm(`⚠️ Remettre le jeu Secret BAFA de "${formationName}" à zéro ? Tous les secrets, buzz et points seront effacés (les joueurs et la formation sont conservés). Cette action est irréversible.`)) return;
    if (!confirm(`Dernière confirmation — vraiment effacer le jeu de "${formationName}" ?`)) return;

    setLoading(true);
    const res = await fetch(`/api/admin/formations/${formationId}/reset`, { method: "DELETE" });
    setLoading(false);

    if (res.ok) {
      router.refresh();
    } else {
      alert("Erreur lors du reset.");
    }
  }

  return (
    <div
      className="card"
      style={{ borderLeftColor: "#dc2626", background: "#fff5f5" }}
    >
      <div style={{ fontWeight: 800, marginBottom: 6, color: "#dc2626" }}>
        Zone dangereuse
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 14, color: "#64748b" }}>
        Efface les secrets, buzz et points du jeu de cette formation, et relance la partie (fin du jeu, pause des buzz). Les joueurs, le planning, les évaluations et les comptes ne sont pas touchés.
      </p>
      <button className="btn btn-danger" onClick={reset} disabled={loading}>
        {loading ? "Réinitialisation…" : "🗑️ Réinitialiser le jeu"}
      </button>
    </div>
  );
}
