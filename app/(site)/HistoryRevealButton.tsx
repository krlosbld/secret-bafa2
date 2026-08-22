"use client";

import { useState } from "react";

export default function HistoryRevealButton({ secretId, cost }: { secretId: string; cost: number }) {
  const [open, setOpen] = useState(false);
  const [fromCode, setFromCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ wrongNames: string[]; pointsRemaining: number } | null>(null);

  function handleOpen() {
    setError("");
    setResult(null);
    setFromCode("");
    setOpen(true);
  }

  async function reveal() {
    setError("");
    if (!fromCode.trim()) {
      setError("Ton code personnel est requis.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/secrets/${secretId}/history-reveal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Erreur.");
        return;
      }
      setResult({ wrongNames: data.wrongNames, pointsRemaining: data.pointsRemaining });
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="btn btn-ghost"
        style={{ fontSize: 12, padding: "4px 10px" }}
      >
        🔍 Découvrir l&apos;historique ({cost} pts)
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 9999,
          }}
        >
          <div onClick={(e) => e.stopPropagation()} className="sb-modal" style={{ maxWidth: 420 }}>
            <div className="sb-modal__header">
              <h2>🔍 Historique du secret</h2>
              <button className="sb-x" onClick={() => setOpen(false)}>✕</button>
            </div>

            {result ? (
              <div>
                {result.wrongNames.length === 0 ? (
                  <p className="sb-help">Personne ne s&apos;est trompé sur ce secret pour l&apos;instant.</p>
                ) : (
                  <>
                    <p className="sb-help">Prénoms déjà proposés et faux sur ce secret :</p>
                    <ul style={{ margin: "8px 0", paddingLeft: 20 }}>
                      {result.wrongNames.map((name) => (
                        <li key={name} style={{ fontWeight: 700 }}>{name}</li>
                      ))}
                    </ul>
                  </>
                )}
                <p style={{ fontSize: 13, color: "#64748b", marginTop: 10 }}>
                  Il te reste {result.pointsRemaining} point{result.pointsRemaining > 1 ? "s" : ""}.
                </p>
                <div className="sb-actions">
                  <button className="sb-btn sb-btn--main" onClick={() => setOpen(false)}>
                    Fermer
                  </button>
                </div>
              </div>
            ) : (
              <div className="sb-form" style={{ marginTop: 12 }}>
                <p className="sb-help">Ça te coûtera {cost} points pour voir les prénoms déjà devinés à tort sur ce secret.</p>
                <label className="sb-field">
                  <span>Ton code personnel</span>
                  <input
                    value={fromCode}
                    onChange={(e) => setFromCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="Ex : 4823"
                    inputMode="numeric"
                    maxLength={4}
                    disabled={loading}
                    style={{ letterSpacing: 4, fontWeight: 700, fontSize: 18 }}
                  />
                </label>
                {error && (
                  <div
                    style={{
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
                <div className="sb-actions">
                  <button className="sb-btn sb-btn--ghost" onClick={() => setOpen(false)} disabled={loading}>
                    Annuler
                  </button>
                  <button className="sb-btn sb-btn--main" onClick={reveal} disabled={loading}>
                    {loading ? "…" : `Débloquer (${cost} pts)`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
