"use client";

import { useState } from "react";

type HistoryBuzz = {
  id: string;
  guessedName: string;
  isCorrect: boolean;
  status: string;
  createdAt: string;
  fromPlayer: { firstName: string; code: string };
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "À valider",
  VALIDATED: "Validé",
  REJECTED: "Rejeté",
};

export default function SecretHistoryButton({ secretId }: { secretId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [buzzes, setBuzzes] = useState<HistoryBuzz[] | null>(null);
  const [error, setError] = useState("");

  async function openHistory() {
    setOpen(true);
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/secrets/${secretId}/history`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Erreur.");
        return;
      }
      setBuzzes(data.buzzes);
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button className="btn btn-ghost" style={{ padding: "1px 8px", fontSize: 12 }} onClick={openHistory}>
        🕓 Historique
      </button>

      {open && (
        <div className="sb-backdrop" onClick={() => setOpen(false)}>
          <div className="sb-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, maxHeight: "80vh", overflowY: "auto" }}>
            <div className="sb-modal__header">
              <h2>🕓 Historique des buzz</h2>
              <button className="sb-x" onClick={() => setOpen(false)}>✕</button>
            </div>

            {loading && <p style={{ color: "#64748b", fontSize: 14 }}>Chargement…</p>}
            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: 10, color: "#dc2626", fontWeight: 600, fontSize: 14 }}>
                {error}
              </div>
            )}
            {!loading && !error && buzzes && buzzes.length === 0 && (
              <p style={{ color: "#64748b", fontSize: 14 }}>Aucun buzz sur ce secret pour l&apos;instant.</p>
            )}
            {!loading && !error && buzzes && buzzes.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {buzzes.map((b) => (
                  <div
                    key={b.id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderLeft: `3px solid ${b.isCorrect ? "#16a34a" : "#e11d48"}`,
                      borderRadius: 8,
                      padding: "8px 12px",
                      fontSize: 13,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700 }}>
                        {b.fromPlayer.firstName} · #{b.fromPlayer.code}
                      </span>
                      <span style={{ color: "#94a3b8" }}>
                        {new Date(b.createdAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <span style={{ fontWeight: b.isCorrect ? 800 : 600, color: b.isCorrect ? "#16a34a" : "#e11d48" }}>
                        {b.guessedName} {b.isCorrect ? "✅" : "❌"}
                      </span>
                      <span style={{ marginLeft: 8, fontSize: 12, color: "#64748b" }}>
                        {STATUS_LABEL[b.status] ?? b.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
