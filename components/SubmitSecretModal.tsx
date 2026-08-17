"use client";

import { useState } from "react";
import { isFlagged } from "@/lib/contentFilter";

type State = "form" | "loading" | "success";

export default function SubmitSecretModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [state, setState] = useState<State>("form");
  const [firstName, setFirstName] = useState("");
  const [content, setContent] = useState("");
  const [bonus, setBonus] = useState(1);
  const [code, setCode] = useState("");
  const [attached, setAttached] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  function handleClose() {
    if (state === "success") {
      setFirstName("");
      setContent("");
      setBonus(1);
      setCode("");
      setAttached(false);
      setState("form");
    }
    setError("");
    onClose();
  }

  async function submit() {
    setError("");
    setState("loading");
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, content, bonus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Erreur.");
        setState("form");
        return;
      }
      if (data.attached) {
        setAttached(true);
      } else {
        setCode(data.code);
      }
      setState("success");
    } catch {
      setError("Erreur réseau.");
      setState("form");
    }
  }

  return (
    <div className="sb-backdrop" onMouseDown={handleClose}>
      <div className="sb-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sb-modal__header">
          <h2>{state === "success" ? "Secret envoyé ✅" : "Ajouter mon secret"}</h2>
          <button className="sb-x" onClick={handleClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        {state === "success" ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            {attached ? (
              <>
                <p style={{ color: "#555", marginBottom: 8 }}>
                  Ton secret est en attente de validation. Un compte existait déjà pour ce prénom — le
                  secret y a été rattaché.
                </p>
                <p style={{ color: "#0f766e", fontWeight: 700, fontSize: 14 }}>
                  Utilise ton code personnel habituel pour te connecter.
                </p>
              </>
            ) : (
              <>
                <p style={{ color: "#555", marginBottom: 8 }}>
                  Ton secret est en attente de validation. Voici ton code personnel :
                </p>
                <div
                  style={{
                    fontSize: 64,
                    fontWeight: 900,
                    color: "#0f766e",
                    letterSpacing: 8,
                    margin: "16px 0",
                  }}
                >
                  #{code}
                </div>
                <p style={{ color: "#e11d48", fontWeight: 700, fontSize: 14 }}>
                  Note ce code ! Tu en auras besoin pour buzzer les secrets des autres.
                </p>
              </>
            )}
            <button
              className="sb-btn sb-btn--main"
              onClick={handleClose}
              style={{ marginTop: 20 }}
            >
              OK, je l&apos;ai noté !
            </button>
          </div>
        ) : (
          <>
            <p className="sb-help">
              Ton prénom est visible par l&apos;admin uniquement. La page publique reste anonyme.
            </p>
            <div className="sb-form">
              <label className="sb-field">
                <span>Prénom</span>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ex : Lucas"
                  maxLength={40}
                  disabled={state === "loading"}
                />
              </label>

              <label className="sb-field">
                <span>Secret</span>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Écris ton secret..."
                  maxLength={800}
                  disabled={state === "loading"}
                />
              </label>

              {isFlagged(content) && (
                <div style={{
                  background: "#fffbeb",
                  border: "1px solid #f59e0b",
                  borderRadius: 10,
                  padding: "10px 14px",
                  color: "#92400e",
                  fontSize: 13,
                  fontWeight: 600,
                }}>
                  ⚠️ Ton secret semble contenir du contenu potentiellement illégal. Tu peux quand même l&apos;envoyer, mais il sera examiné attentivement par l&apos;animateur avant validation.
                </div>
              )}

              <label className="sb-field">
                <span>Points bonus (1 à 5) — difficulté de ton secret</span>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setBonus(n)}
                      disabled={state === "loading"}
                      style={{
                        flex: 1,
                        padding: "8px 0",
                        borderRadius: 10,
                        border: "2px solid",
                        borderColor: bonus === n ? "#0f766e" : "#ddd",
                        background: bonus === n ? "#0f766e" : "white",
                        color: bonus === n ? "white" : "#333",
                        fontWeight: 800,
                        cursor: "pointer",
                        fontSize: 16,
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
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
                <button className="sb-btn sb-btn--ghost" onClick={handleClose} disabled={state === "loading"}>
                  Annuler
                </button>
                <button
                  className="sb-btn sb-btn--main"
                  onClick={submit}
                  disabled={state === "loading" || !firstName.trim() || !content.trim()}
                >
                  {state === "loading" ? "Envoi..." : "Envoyer"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
