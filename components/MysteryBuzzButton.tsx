"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// « ❓ Buzz mystère » sous un secret : question fermée au maître du jeu (une fois par partie).
export default function MysteryBuzzButton({ secretId, secretContent }: { secretId: string; secretContent: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function send() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/game/mystery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secretId, text }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) {
      setError(data.error || "Envoi impossible.");
      return;
    }
    setSent(true);
  }

  // Le rafraîchissement (« Mes pouvoirs », bouton qui disparaît) attend la fermeture de la fenêtre :
  // sinon le bouton — et sa fenêtre — disparaîtraient avant que le joueur lise la confirmation.
  function close() {
    setOpen(false);
    if (sent) router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setSent(false);
          setError("");
        }}
        style={{ background: "#fff", color: "#6b21a8", border: "2px solid #c4b5fd", padding: "8px 14px", borderRadius: 10, fontWeight: 800, cursor: "pointer" }}
      >
        ❓ Buzz mystère
      </button>
      {open && (
        <div className="sb-backdrop" onMouseDown={() => !busy && close()}>
          <div className="sb-modal" role="dialog" aria-label="Buzz mystère" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="sb-modal__header">
              <h2>❓ Buzz mystère</h2>
              <button className="sb-x" onClick={close} disabled={busy} aria-label="Fermer">
                ✕
              </button>
            </div>
            {sent ? (
              <>
                <p className="sb-help">Ta question est envoyée au maître du jeu. Sa réponse apparaîtra dans « Mes pouvoirs ».</p>
                <div className="sb-actions">
                  <button className="sb-btn sb-btn--main" onClick={close}>
                    Fermer
                  </button>
                </div>
              </>
            ) : (
              <div className="sb-form">
                <p className="sb-help" style={{ fontStyle: "italic" }}>« {secretContent} »</p>
                <p className="sb-help">
                  Pose une question fermée sur ce secret : le maître du jeu répondra seulement <strong>Oui</strong> ou <strong>Non</strong>. Une
                  seule fois par partie. Interdit : toute question sur l&apos;auteur (prénom, groupe, rôle, genre, âge…) — elle serait refusée
                  et tu pourrais la reformuler.
                </p>
                <label className="sb-field">
                  <span>Ta question</span>
                  <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={300} rows={3} placeholder="Ex. : Est-ce que ça s'est passé à l'étranger ?" disabled={busy} />
                </label>
                {error && (
                  <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: 10, color: "#dc2626", fontWeight: 600, fontSize: 14 }}>
                    {error}
                  </div>
                )}
                <div className="sb-actions">
                  <button className="sb-btn sb-btn--ghost" onClick={() => setOpen(false)} disabled={busy}>
                    Annuler
                  </button>
                  <button className="sb-btn sb-btn--main" onClick={send} disabled={busy || text.trim().length < 8}>
                    {busy ? "Envoi…" : "Envoyer au maître du jeu"}
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
