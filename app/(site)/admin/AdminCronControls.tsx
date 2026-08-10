"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminCronControls({ formationId }: { formationId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"reset" | "award" | null>(null);
  const [message, setMessage] = useState("");

  async function resetBuzz() {
    if (!confirm("Remettre à zéro le compteur de buzz de tous les joueurs de cette formation ?")) return;
    setLoading("reset");
    setMessage("");
    const res = await fetch(`/api/admin/formations/${formationId}/reset-buzz`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setLoading(null);
    if (res.ok) {
      setMessage(`✅ Buzz remis à zéro pour ${data.updated} joueur(s).`);
      router.refresh();
    } else {
      setMessage("Erreur.");
    }
  }

  async function awardPoints() {
    if (!confirm("Attribuer +1 point à chaque auteur d'un secret publié pas encore trouvé ?")) return;
    setLoading("award");
    setMessage("");
    const res = await fetch(`/api/admin/formations/${formationId}/award-points`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setLoading(null);
    if (res.ok) {
      setMessage(`✅ +1 point attribué à ${data.updated} joueur(s).`);
      router.refresh();
    } else {
      setMessage("Erreur.");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-ghost" onClick={resetBuzz} disabled={loading !== null}>
          {loading === "reset" ? "Reset en cours…" : "🔄 Reset tous les buzz"}
        </button>
        <button className="btn btn-ghost" onClick={awardPoints} disabled={loading !== null}>
          {loading === "award" ? "Attribution…" : "🎁 +1 pt aux secrets non trouvés"}
        </button>
      </div>
      {message && <div style={{ fontSize: 13, color: "#0f766e", fontWeight: 700 }}>{message}</div>}
    </div>
  );
}
