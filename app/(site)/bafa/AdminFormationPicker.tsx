"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type FormationOption = { id: string; name: string };

export default function AdminFormationPicker({ options }: { options: FormationOption[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function choose(formationId: string) {
    setError("");
    setLoading(formationId);
    const res = await fetch("/api/admin/select-formation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formationId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || "Erreur.");
      setLoading(null);
      return;
    }
    router.refresh();
  }

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 480 }}>
        <h1 className="h1">Choisis une formation</h1>
        <p className="sub" style={{ marginBottom: 20 }}>
          Plusieurs formations sont actives en même temps — laquelle veux-tu gérer ?
        </p>
        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: 10, color: "#dc2626", fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
            {error}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {options.map((o) => (
            <button
              key={o.id}
              className="card"
              onClick={() => choose(o.id)}
              disabled={loading !== null}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, textAlign: "left", cursor: "pointer", border: "none" }}
            >
              <span style={{ fontWeight: 800 }}>{o.name}</span>
              {loading === o.id && <span style={{ fontSize: 13, color: "#64748b" }}>…</span>}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
