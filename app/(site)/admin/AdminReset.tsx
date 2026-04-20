"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminReset() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function reset() {
    if (!confirm("⚠️ Supprimer TOUS les joueurs, secrets et buzz ? Cette action est irréversible.")) return;
    if (!confirm("Dernière confirmation — vraiment tout effacer ?")) return;

    setLoading(true);
    const res = await fetch("/api/admin/reset", { method: "DELETE" });
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
        Supprime tous les joueurs, secrets et buzz. À utiliser uniquement pour repartir de zéro.
      </p>
      <button className="btn btn-danger" onClick={reset} disabled={loading}>
        {loading ? "Suppression…" : "🗑️ Tout réinitialiser"}
      </button>
    </div>
  );
}
