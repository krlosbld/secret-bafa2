"use client";

import { useEffect, useRef, useState } from "react";
import { dateForDayIndex, formatDayHeader } from "@/lib/planningConfig";

export default function DailyRemarkBox({
  playerId,
  dayCount,
  startDate,
  initialDay,
  initialNotes,
  canEdit,
}: {
  playerId: string;
  dayCount: number;
  startDate: string;
  initialDay: number;
  initialNotes: Record<number, string>;
  canEdit: boolean;
}) {
  const [activeDay, setActiveDay] = useState(initialDay);
  const [notes, setNotes] = useState<Record<number, string>>(initialNotes);
  const [draft, setDraft] = useState(initialNotes[initialDay] ?? "");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const stateRef = useRef({ notes, activeDay });
  useEffect(() => {
    stateRef.current = { notes, activeDay };
  }, [notes, activeDay]);

  useEffect(() => {
    setDraft(notes[activeDay] ?? "");
  }, [activeDay, notes]);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/players/${playerId}/remarks`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!data?.ok) return;
        const fresh: Record<number, string> = data.notes;
        const { notes: curNotes, activeDay: curDay } = stateRef.current;
        const curDraft = curNotes[curDay] ?? "";
        setNotes((n) => {
          const next = { ...n, ...fresh };
          return next;
        });
        // ne pas écraser une saisie en cours sur le jour actif
        if ((fresh[curDay] ?? "") !== curDraft) {
          setDraft((d) => (d === curDraft ? fresh[curDay] ?? "" : d));
        }
      } catch {
        // ignore transient network errors, will retry on next tick
      }
    }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId]);

  async function persist() {
    setSaving(true);
    await fetch(`/api/players/${playerId}/remarks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day: activeDay, note: draft }),
    });
    setNotes((n) => ({ ...n, [activeDay]: draft }));
    setSaving(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  const savedValue = notes[activeDay] ?? "";

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 800 }}>Remarque</div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            className="btn btn-ghost"
            style={{ padding: "2px 8px", fontSize: 12 }}
            onClick={() => setActiveDay((d) => Math.max(0, d - 1))}
            disabled={activeDay === 0}
          >
            ←
          </button>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#475569", minWidth: 60, textAlign: "center" }}>
            {formatDayHeader(dateForDayIndex(startDate, activeDay))}
          </span>
          <button
            className="btn btn-ghost"
            style={{ padding: "2px 8px", fontSize: 12 }}
            onClick={() => setActiveDay((d) => Math.min(dayCount - 1, d + 1))}
            disabled={activeDay === dayCount - 1}
          >
            →
          </button>
        </div>
      </div>

      <p style={{ fontSize: 12, color: "#64748b", marginTop: 0, marginBottom: 8 }}>
        Conseils ou observations du jour, sans lien avec un créneau précis.
      </p>

      {canEdit ? (
        <>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="Écris une remarque pour ce jour…"
            style={{ width: "100%", border: "1px solid #ddd", borderRadius: 8, padding: 8, fontSize: 14, resize: "vertical" }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 6 }}>
            {saving ? (
              <span style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>Enregistrement…</span>
            ) : savedFlash ? (
              <span style={{ color: "#16a34a", fontSize: 12, fontWeight: 700 }}>Enregistré ✓</span>
            ) : draft !== savedValue ? (
              <span style={{ color: "#94a3b8", fontSize: 12 }}>Non enregistré</span>
            ) : null}
            <button className="btn btn-ghost" style={{ padding: "4px 12px", fontSize: 13 }} disabled={saving || draft === savedValue} onClick={persist}>
              Enregistrer
            </button>
          </div>
        </>
      ) : (
        <p style={{ color: savedValue ? "#0f172a" : "#94a3b8", fontSize: 14, whiteSpace: "pre-wrap", margin: 0 }}>
          {savedValue || "Rien pour l'instant."}
        </p>
      )}
    </div>
  );
}
