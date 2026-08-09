"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PersonalNoteReminder({ playerId }: { playerId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function save() {
    if (!note.trim()) {
      setError("Écris au moins quelques mots avant d'enregistrer.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/players/${playerId}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personalNote: note.trim() }),
      });
      if (!res.ok) {
        setError("Erreur, réessaie.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Erreur réseau.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sb-backdrop" onMouseDown={() => setOpen(false)}>
      <div className="sb-modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="sb-modal__header">
          <h2>✍️ Ton info personnelle</h2>
        </div>

        <p className="sb-help">
          Tu n&apos;as pas encore rempli ta case &quot;Info personnelle&quot;. C&apos;est l&apos;endroit où tu peux
          écrire ce que tu veux porter à la connaissance de l&apos;équipe de formation (une question, une
          remarque, une situation particulière...).
        </p>

        <div className="sb-form">
          <label className="sb-field">
            <span>Ton message</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder="Écris ici..."
              disabled={saving}
              style={{ resize: "vertical" }}
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
            <button className="sb-btn sb-btn--ghost" onClick={() => setOpen(false)} disabled={saving}>
              Plus tard
            </button>
            <button className="sb-btn sb-btn--main" onClick={save} disabled={saving || !note.trim()}>
              {saving ? "Envoi..." : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
