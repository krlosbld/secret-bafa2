"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminEndGame({ formationId, gameEnded }: { formationId: string; gameEnded: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

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

  if (gameEnded) {
    return <p style={{ color: "#64748b", fontSize: 14, fontWeight: 700 }}>🏁 Le jeu est terminé — plus aucun buzz possible.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <button className="btn btn-danger" onClick={endGame} disabled={loading}>
          {loading ? "…" : "🏁 Terminer le jeu"}
        </button>
      </div>
      {message && <div style={{ fontSize: 13, color: "#0f766e", fontWeight: 700 }}>{message}</div>}
    </div>
  );
}
