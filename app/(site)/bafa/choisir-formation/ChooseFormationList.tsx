"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type FormationOption = {
  playerId: string;
  formationName: string;
  active: boolean;
};

export default function ChooseFormationList({ options }: { options: FormationOption[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function choose(playerId: string) {
    setError("");
    setLoading(playerId);
    const res = await fetch("/api/director/choose-formation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || "Erreur.");
      setLoading(null);
      return;
    }
    router.replace("/bafa");
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: 10, color: "#dc2626", fontWeight: 600, fontSize: 14 }}>
          {error}
        </div>
      )}
      {options.map((o) => (
        <button
          key={o.playerId}
          className="card"
          onClick={() => choose(o.playerId)}
          disabled={loading !== null}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, textAlign: "left", cursor: "pointer", border: "none" }}
        >
          <span style={{ fontWeight: 800 }}>{o.formationName}</span>
          {o.active ? (
            <span style={{ fontSize: 12, fontWeight: 800, color: "#16a34a", background: "#dcfce7", padding: "2px 8px", borderRadius: 999 }}>
              Active
            </span>
          ) : (
            <span style={{ fontSize: 12, color: "#94a3b8" }}>Terminée</span>
          )}
        </button>
      ))}
    </div>
  );
}
