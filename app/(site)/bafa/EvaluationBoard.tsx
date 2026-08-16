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
  initialAuthors,
  canEdit,
  playerId,
}: {
  blocks: EvalBlock[];
  postes: Poste[];
  activeDay: number;
  initialNotes: Record<string, string>;
  initialAuthors: Record<string, string | null>;
  canEdit: boolean;
  playerId: string;
}) {
  const [notes, setNotes] = useState<Record<string, string>>(initialNotes);
  const [drafts, setDrafts] = useState<Record<string, string>>(initialNotes);
  const [authors, setAuthors] = useState<Record<string, string | null>>(initialAuthors);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  const stateRef = useRef({ notes, drafts });
  useEffect(() => {
    stateRef.current = { notes, drafts };
  }, [notes, drafts]);

  async function persist(blockId: string, note: string) {
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

  // Toutes les 5s : sauvegarde les brouillons modifiés, puis récupère les notes des autres formateurs.
  useEffect(() => {
    const id = setInterval(async () => {
      const { notes: curNotes, drafts: curDrafts } = stateRef.current;

      const dirty = Object.entries(curDrafts).filter(([blockId, val]) => (val ?? "") !== (curNotes[blockId] ?? ""));
      for (const [blockId, note] of dirty) {
        await persist(blockId, note);
      }

      try {
        const res = await fetch(`/api/evaluations?playerId=${playerId}`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!data?.ok) return;

        const fresh: Record<string, string> = data.notes;
        const { notes: latestNotes, drafts: latestDrafts } = stateRef.current;
        const nextNotes = { ...latestNotes };
        const nextDrafts = { ...latestDrafts };
        let changed = false;

        for (const [blockId, note] of Object.entries(fresh)) {
          const hasUnsavedEdit = (latestDrafts[blockId] ?? "") !== (latestNotes[blockId] ?? "");
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
        if (data.authors) setAuthors(data.authors);
      } catch {
        // ignore transient network errors, will retry on next tick
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, 5000);
    return () => clearInterval(id);
  }, [playerId]);

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
                {authors[b.id] && (
                  <p style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic", marginTop: 0, marginBottom: 6 }}>
                    Écrit par {authors[b.id]}
                  </p>
                )}
                <textarea
                  value={drafts[b.id] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [b.id]: e.target.value }))}
                  rows={3}
                  placeholder="Qu'a fait ce stagiaire pendant ce créneau ?"
                  style={{ width: "100%", border: "1px solid #ddd", borderRadius: 8, padding: 8, fontSize: 14, resize: "vertical" }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 6 }}>
                  {saving === b.id ? (
                    <span style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>Enregistrement…</span>
                  ) : savedFlash === b.id ? (
                    <span style={{ color: "#16a34a", fontSize: 12, fontWeight: 700 }}>Enregistré ✓</span>
                  ) : (drafts[b.id] ?? "") !== (notes[b.id] ?? "") ? (
                    <span style={{ color: "#94a3b8", fontSize: 12 }}>Sauvegarde automatique…</span>
                  ) : null}
                  <button
                    className="btn btn-ghost"
                    style={{ padding: "4px 12px", fontSize: 13 }}
                    disabled={saving === b.id || (drafts[b.id] ?? "") === (notes[b.id] ?? "")}
                    onClick={() => persist(b.id, drafts[b.id] ?? "")}
                  >
                    Enregistrer maintenant
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
