"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminEndGame({
  formationId,
  gameEnded,
  initialBuzzPaused,
}: {
  formationId: string;
  gameEnded: boolean;
  initialBuzzPaused: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [buzzPaused, setBuzzPaused] = useState(initialBuzzPaused);
  const [togglingPause, setTogglingPause] = useState(false);

  async function endGame() {
    if (
      !confirm(
        "Terminer le jeu ? Il ne sera plus possible de buzzer. Les secrets encore non trouvés ne seront pas révélés, mais leur bonus + 10 points seront attribués à leur propriétaire. Cette action est irréversible."
      )
    )
      return;
    setLoading(true);
    setMessage("");
    const res = await fetch(`/api/admin/formations/${formationId}/end-game`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      setMessage(`✅ Jeu terminé. Bonus + 10 pts attribués à ${data.updated} propriétaire(s) de secret non trouvé.`);
      router.refresh();
    } else {
      setMessage(data.error || "Erreur.");
    }
  }

  async function toggleBuzzPaused() {
    const next = !buzzPaused;
    setTogglingPause(true);
    setBuzzPaused(next);
    await fetch("/api/admin/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buzzPaused: next }),
    });
    router.refresh();
    setTogglingPause(false);
  }

  if (gameEnded) {
    return <p style={{ color: "#64748b", fontSize: 14, fontWeight: 700 }}>🏁 Le jeu est terminé — plus aucun buzz possible.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <button className="btn btn-danger" onClick={endGame} disabled={loading}>
          {loading ? "…" : "🏁 Terminer le jeu"}
        </button>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          <input type="checkbox" checked={buzzPaused} onChange={toggleBuzzPaused} disabled={togglingPause} />
          ⏸️ Bloquer tous les buzz
        </label>
      </div>
      {buzzPaused && (
        <p style={{ fontSize: 13, color: "#dc2626", fontWeight: 700 }}>
          Les buzz sont actuellement suspendus — décoche pour les réactiver.
        </p>
      )}
      {message && <div style={{ fontSize: 13, color: "#0f766e", fontWeight: 700 }}>{message}</div>}
    </div>
  );
}
