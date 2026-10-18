"use client";

import { useState } from "react";

// Prénoms des joueurs (liste déroulante) : chargés à l'ouverture, partagés entre les boutons de la page.
let namesCache: { at: number; names: string[] } | null = null;
async function loadNames(): Promise<string[]> {
  if (namesCache && Date.now() - namesCache.at < 15000) return namesCache.names;
  const res = await fetch("/api/game/buzz-names", { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  const names: string[] = Array.isArray(data.names) ? data.names : [];
  namesCache = { at: Date.now(), names };
  return names;
}

export default function BuzzButton({ secretId }: { secretId: string }) {
  const [open, setOpen] = useState(false);
  const [guessedName, setGuessedName] = useState("");
  const [claimFake, setClaimFake] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [claimFakeResult, setClaimFakeResult] = useState<{ correct: boolean; points?: number } | null>(null);
  const [names, setNames] = useState<string[] | null>(null);

  function handleOpen() {
    setError("");
    setSuccess(false);
    setClaimFake(false);
    setClaimFakeResult(null);
    setGuessedName("");
    setOpen(true);
    loadNames()
      .then(setNames)
      .catch(() => setNames([]));
  }

  async function sendBuzz() {
    setError("");
    if (!claimFake && !guessedName.trim()) {
      setError("Choisis à qui appartient ce secret.");
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
      namesCache = null;
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
                    <select value={guessedName} onChange={(e) => setGuessedName(e.target.value)} disabled={loading || names === null}>
                      <option value="">{names === null ? "Chargement…" : "Choisis un joueur…"}</option>
                      {(names ?? []).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
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
