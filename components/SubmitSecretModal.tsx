"use client";

import { useState } from "react";

export default function SubmitSecretModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [content, setContent] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function submit() {
    setMsg("");
    setLoading(true);

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, content }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMsg(data?.message || "Erreur.");
        return;
      }

      setMsg("Secret envoyé ✅ (en attente de validation Admin)");
      setFirstName("");
      setContent("");
    } catch {
      setMsg("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sb-backdrop" onMouseDown={onClose}>
      <div className="sb-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sb-modal__header">
          <h2>Soumettre un secret</h2>
          <button className="sb-x" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <p className="sb-help">
          Le prénom est enregistré (visible par l’Admin), mais la page publique
          reste anonyme.
        </p>

        <div className="sb-form">
          <label className="sb-field">
            <span>Prénom</span>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Ex : Lucas"
              maxLength={40}
            />
          </label>

          <label className="sb-field">
            <span>Secret</span>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Écris ton secret..."
              maxLength={800}
            />
          </label>

          {msg && (
            <div
              style={{
                background: "#f4f4f5",
                borderRadius: 12,
                padding: 10,
                fontWeight: 700,
              }}
            >
              {msg}
            </div>
          )}

          <div className="sb-actions">
            <button className="sb-btn sb-btn--ghost" onClick={onClose}>
              Annuler
            </button>
            <button
              className="sb-btn sb-btn--main"
              onClick={submit}
              disabled={loading}
            >
              {loading ? "Envoi..." : "Envoyer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}