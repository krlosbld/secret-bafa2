"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type FormationOption = {
  playerId: string;
  formationName: string;
  active: boolean;
  startDate: string | null;
};

function statusOf(o: FormationOption): { label: string; color: string; background: string } {
  if (o.active) return { label: "Active", color: "#16a34a", background: "#dcfce7" };
  if (o.startDate && new Date(o.startDate) > new Date()) {
    return { label: "À venir", color: "#2563eb", background: "#dbeafe" };
  }
  return { label: "Terminée", color: "#64748b", background: "#f1f5f9" };
}

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
      {options.map((o) => {
        const status = statusOf(o);
        return (
          <button
            key={o.playerId}
            className="card"
            onClick={() => choose(o.playerId)}
            disabled={loading !== null}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, textAlign: "left", cursor: "pointer", border: "none" }}
          >
            <span style={{ fontWeight: 800 }}>{o.formationName}</span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: status.color,
                background: status.background,
                padding: "2px 8px",
                borderRadius: 999,
              }}
            >
              {status.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
