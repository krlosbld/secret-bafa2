"use client";

import { useEffect, useRef, useState } from "react";
import type { Poste } from "./PlanningTab";

export type EvalBlock = {
  id: string;
  day: number;
  startMin: number;
  endMin: number;
  label: string;
  type: string;
};

function fmt(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function EvaluationBoard({
  blocks,
  postes,
  activeDay,
  initialNotes,
  canEdit,
  playerId,
}: {
  blocks: EvalBlock[];
  postes: Poste[];
  activeDay: number;
  initialNotes: Record<string, string>;
  canEdit: boolean;
  playerId: string;
}) {
  const [notes, setNotes] = useState<Record<string, string>>(initialNotes);
  const [drafts, setDrafts] = useState<Record<string, string>>(initialNotes);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  const stateRef = useRef({ notes, drafts });
  useEffect(() => {
    stateRef.current = { notes, drafts };
  }, [notes, drafts]);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/evaluations?playerId=${playerId}`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!data?.ok) return;

        const fresh: Record<string, string> = data.notes;
        const { notes: curNotes, drafts: curDrafts } = stateRef.current;
        const nextNotes = { ...curNotes };
        const nextDrafts = { ...curDrafts };
        let changed = false;

        for (const [blockId, note] of Object.entries(fresh)) {
          const hasUnsavedEdit = (curDrafts[blockId] ?? "") !== (curNotes[blockId] ?? "");
          if (hasUnsavedEdit) continue;
          if (nextNotes[blockId] !== note) {
            nextNotes[blockId] = note;
            nextDrafts[blockId] = note;
            changed = true;
          }
        }

        if (changed) {
          setNotes(nextNotes);
          setDrafts(nextDrafts);
        }
      } catch {
        // ignore transient network errors, will retry on next tick
      }
    }, 5000);
    return () => clearInterval(id);
  }, [playerId]);

  async function save(blockId: string) {
    const note = drafts[blockId] ?? "";
    setSaving(blockId);
    await fetch("/api/evaluations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, blockId, note }),
    });
    setNotes((n) => ({ ...n, [blockId]: note }));
    setSaving(null);
    setSavedFlash(blockId);
    setTimeout(() => setSavedFlash((v) => (v === blockId ? null : v)), 1500);
  }

  const dayBlocks = blocks.filter((b) => b.day === activeDay).sort((a, b) => a.startMin - b.startMin);

  if (dayBlocks.length === 0) {
    return <p style={{ color: "#64748b", fontSize: 14 }}>Aucun créneau évaluable ce jour-là.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {dayBlocks.map((b) => {
        const poste = postes.find((p) => p.id === b.type);
        return (
          <div key={b.id} className="card" style={{ borderLeftColor: poste?.color ?? "#0f766e" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
              <div style={{ fontWeight: 700 }}>
                {poste?.label ?? b.type} · {b.label}
              </div>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                {fmt(b.startMin)}–{fmt(b.endMin)}
              </div>
            </div>
            {canEdit ? (
              <>
                <textarea
                  value={drafts[b.id] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [b.id]: e.target.value }))}
                  rows={3}
                  placeholder="Qu'a fait ce stagiaire pendant ce créneau ?"
                  style={{ width: "100%", border: "1px solid #ddd", borderRadius: 8, padding: 8, fontSize: 14, resize: "vertical" }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 6 }}>
                  {savedFlash === b.id && (
                    <span style={{ color: "#16a34a", fontSize: 12, fontWeight: 700 }}>Enregistré ✓</span>
                  )}
                  <button
                    className="btn btn-main"
                    style={{ padding: "4px 12px", fontSize: 13 }}
                    disabled={saving === b.id || (drafts[b.id] ?? "") === (notes[b.id] ?? "")}
                    onClick={() => save(b.id)}
                  >
                    {saving === b.id ? "…" : "Enregistrer"}
                  </button>
                </div>
              </>
            ) : (
              <p style={{ color: notes[b.id] ? "#0f172a" : "#94a3b8", fontSize: 14, whiteSpace: "pre-wrap", margin: 0 }}>
                {notes[b.id] || "Pas encore évalué."}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
