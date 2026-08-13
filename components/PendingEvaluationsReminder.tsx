"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PendingBlock } from "@/lib/pendingEvaluations";

function fmt(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function PendingEvaluationsReminder({ initialBlocks }: { initialBlocks: PendingBlock[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [blocks, setBlocks] = useState(initialBlocks);
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    for (const b of initialBlocks) for (const s of b.stagiaires) d[`${b.id}:${s.id}`] = s.note;
    return d;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open || blocks.length === 0) return null;

  function setDraft(blockId: string, playerId: string, value: string) {
    setDrafts((d) => ({ ...d, [`${blockId}:${playerId}`]: value }));
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const toSave: { blockId: string; playerId: string; note: string }[] = [];
      for (const b of blocks) {
        for (const s of b.stagiaires) {
          const key = `${b.id}:${s.id}`;
          if ((drafts[key] ?? "") !== s.note) {
            toSave.push({ blockId: b.id, playerId: s.id, note: drafts[key] ?? "" });
          }
        }
      }
      for (const entry of toSave) {
        await fetch("/api/evaluations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        });
      }

      // Retire les créneaux désormais complets de l'affichage locale.
      setBlocks((bs) =>
        bs
          .map((b) => ({
            ...b,
            stagiaires: b.stagiaires.map((s) => ({ ...s, note: drafts[`${b.id}:${s.id}`] ?? s.note })),
          }))
          .filter((b) => b.stagiaires.some((s) => !s.note.trim()))
      );
      router.refresh();
    } catch {
      setError("Erreur réseau, réessaie.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sb-backdrop" onMouseDown={() => setOpen(false)}>
      <div className="sb-modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: "85vh", overflowY: "auto" }}>
        <div className="sb-modal__header">
          <h2>📝 Retours à saisir</h2>
        </div>

        <p className="sb-help">
          Ces créneaux sont terminés et tu en es responsable — il manque au moins un retour. Remplis ce que tu peux
          directement ici.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {blocks.map((b) => (
            <div key={b.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>
                {b.label} · Jour {b.day + 1} · {fmt(b.startMin)}–{fmt(b.endMin)}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {b.stagiaires.map((s) => (
                  <label key={s.id} className="sb-field">
                    <span>{s.firstName}</span>
                    <textarea
                      value={drafts[`${b.id}:${s.id}`] ?? ""}
                      onChange={(e) => setDraft(b.id, s.id, e.target.value)}
                      rows={2}
                      placeholder="Retour..."
                      disabled={saving}
                      style={{ resize: "vertical" }}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div
            style={{
              marginTop: 12,
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
          <button className="sb-btn sb-btn--main" onClick={save} disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
