"use client";

import { useState } from "react";

export default function BuzzButton({ secretId }: { secretId: string }) {
  const [open, setOpen] = useState(false);
  const [guessedName, setGuessedName] = useState("");
  const [claimFake, setClaimFake] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [claimFakeResult, setClaimFakeResult] = useState<{ correct: boolean; points?: number } | null>(null);

  function handleOpen() {
    setError("");
    setSuccess(false);
    setClaimFake(false);
    setClaimFakeResult(null);
    setOpen(true);
  }

  async function sendBuzz() {
    setError("");
    if (!claimFake && !guessedName.trim()) {
      setError("Indique à qui appartient ce secret.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/buzz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          claimFake ? { secretId, claimFake: true } : { secretId, guessedName }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Erreur.");
        return;
      }
      setClaimFakeResult(data?.claimFakeResult ?? null);
      setSuccess(true);
      setGuessedName("");
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
        style={{
          background: "#e11d48",
          color: "white",
          border: "none",
          padding: "10px 16px",
          borderRadius: 14,
          fontWeight: 900,
          cursor: "pointer",
          fontSize: "0.9rem",
        }}
      >
        BUZZ 🔥
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
          <div
            onClick={(e) => e.stopPropagation()}
            className="sb-modal"
            style={{ maxWidth: 460 }}
          >
            <div className="sb-modal__header">
              <h2>Envoyer un BUZZ 🔥</h2>
              <button className="sb-x" onClick={() => setOpen(false)}>✕</button>
            </div>

            {success ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>{claimFakeResult && !claimFakeResult.correct ? "🤔" : "🎉"}</div>
                <p style={{ fontWeight: 700 }}>
                  {claimFakeResult
                    ? claimFakeResult.correct
                      ? `Bien vu, c'était un faux secret ! +${claimFakeResult.points} points.`
                      : "Ce n'était pas un faux secret — buzz comptabilisé dans ton quota."
                    : "Buzz envoyé ! En attente de validation."}
                </p>
                <button
                  className="sb-btn sb-btn--main"
                  onClick={() => setOpen(false)}
                  style={{ marginTop: 16 }}
                >
                  Fermer
                </button>
              </div>
            ) : (
              <div className="sb-form" style={{ marginTop: 12 }}>
                <p className="sb-help">Tu buzzes avec ton compte BafaPilot.</p>

                {!claimFake && (
                  <label className="sb-field">
                    <span>À qui appartient ce secret ?</span>
                    <input
                      value={guessedName}
                      onChange={(e) => setGuessedName(e.target.value)}
                      placeholder="Prénom de la personne"
                      maxLength={40}
                      disabled={loading}
                    />
                  </label>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setClaimFake((v) => !v);
                  }}
                  disabled={loading}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#6b21a8",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    textAlign: "left",
                    padding: 0,
                  }}
                >
                  {claimFake ? "← Revenir au buzz classique" : "🎭 Je pense que c'est un faux secret"}
                </button>

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
                  <button
                    className="sb-btn sb-btn--ghost"
                    onClick={() => setOpen(false)}
                    disabled={loading}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={sendBuzz}
                    disabled={loading}
                    style={{
                      background: "#e11d48",
                      color: "white",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: 10,
                      fontWeight: 800,
                      cursor: "pointer",
                      opacity: loading ? 0.7 : 1,
                    }}
                  >
                    {loading ? "Envoi..." : claimFake ? "Confirmer" : "Envoyer le buzz"}
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
