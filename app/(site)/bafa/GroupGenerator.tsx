"use client";

import { useEffect, useState } from "react";

type Assignment = {
  groupCount: number;
  groups: { id: string; firstName: string }[][];
  generatedAt: string;
} | null;

export default function GroupGenerator({ initialAssignment }: { initialAssignment: Assignment }) {
  const [assignment, setAssignment] = useState<Assignment>(initialAssignment);
  const [groupCount, setGroupCount] = useState(String(initialAssignment?.groupCount ?? 3));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/groups", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (data?.ok) setAssignment(data.assignment);
      } catch {
        // ignore transient network errors, will retry on next tick
      }
    }, 5000);
    return () => clearInterval(id);
  }, []);

  async function generate() {
    const n = Number(groupCount);
    if (!Number.isInteger(n) || n < 1) {
      setError("Entre un nombre de groupes valide.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupCount: n }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Erreur.");
        return;
      }
      setAssignment(data.assignment);
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Nombre de groupes</span>
            <input
              type="number"
              min={1}
              value={groupCount}
              onChange={(e) => setGroupCount(e.target.value)}
              style={{ width: 70, border: "1px solid #ddd", borderRadius: 8, padding: "6px 8px", fontSize: 14 }}
            />
          </label>
          <button className="btn btn-main" onClick={generate} disabled={loading}>
            {loading ? "Génération…" : "🎲 Générer"}
          </button>
          {assignment && (
            <span style={{ fontSize: 12, color: "#64748b" }}>
              Dernière génération : {new Date(assignment.generatedAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}
            </span>
          )}
        </div>
        {error && (
          <div
            style={{
              marginTop: 10,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 10,
              padding: 10,
              color: "#dc2626",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}
      </div>

      {!assignment ? (
        <p style={{ color: "#64748b" }}>Aucun groupe généré pour l'instant.</p>
      ) : (
        <div className="cards">
          {assignment.groups.map((group, i) => (
            <div key={i} className="card admin-card">
              <div style={{ fontWeight: 800, marginBottom: 8 }}>
                Groupe {i + 1} ({group.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {group.map((p) => (
                  <div key={p.id} style={{ fontSize: 14, color: "#334155" }}>
                    {p.firstName}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
