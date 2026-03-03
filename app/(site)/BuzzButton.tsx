"use client";

import { useState } from "react";

export default function BuzzButton({ secretId }: { secretId: string }) {
  const [open, setOpen] = useState(false);
  const [fromName, setFromName] = useState("");
  const [toName, setToName] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendBuzz() {
    if (!fromName.trim() || !toName.trim()) return;

    setLoading(true);

    try {
      const res = await fetch("/api/buzz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secretId, fromName, toName }),
      });

      if (!res.ok) throw new Error();

      alert("Buzz envoyé 🔥");
      setOpen(false);
      setFromName("");
      setToName("");
    } catch {
      alert("Erreur lors de l’envoi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          background: "#e11d48",
          color: "white",
          border: "none",
          padding: "10px 14px",
          borderRadius: 14,
          fontWeight: 900,
          cursor: "pointer",
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
            style={{
              background: "white",
              padding: 20,
              borderRadius: 16,
              width: "100%",
              maxWidth: 420,
            }}
          >
            <h3 style={{ marginTop: 0 }}>Envoyer un BUZZ</h3>

            <input
              placeholder="Ton nom"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              style={{ width: "100%", marginBottom: 10, padding: 10 }}
            />

            <input
              placeholder="Qui tu buzz ?"
              value={toName}
              onChange={(e) => setToName(e.target.value)}
              style={{ width: "100%", marginBottom: 14, padding: 10 }}
            />

            <button
              onClick={sendBuzz}
              disabled={loading}
              style={{
                background: "#e11d48",
                color: "white",
                border: "none",
                padding: "10px 12px",
                borderRadius: 12,
                fontWeight: 800,
                width: "100%",
                cursor: "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Envoi..." : "Envoyer"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}