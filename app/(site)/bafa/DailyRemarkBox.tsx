"use client";

import { useEffect, useRef, useState } from "react";
import { dateForDayIndex, formatDayHeader } from "@/lib/planningConfig";
import AutoGrowTextarea from "./AutoGrowTextarea";

export default function DailyRemarkBox({
  playerId,
  day,
  startDate,
  initialNotes,
  initialAuthors,
  canEdit,
}: {
  playerId: string;
  day: number;
  startDate: string;
  initialNotes: Record<number, string>;
  initialAuthors: Record<number, string | null>;
  canEdit: boolean;
}) {
  const [notes, setNotes] = useState<Record<number, string>>(initialNotes);
  const [authors, setAuthors] = useState<Record<number, string | null>>(initialAuthors);
  const [draft, setDraft] = useState(initialNotes[day] ?? "");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const stateRef = useRef({ notes, day });
  useEffect(() => {
    stateRef.current = { notes, day };
  }, [notes, day]);

  useEffect(() => {
    setDraft(notes[day] ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/players/${playerId}/remarks`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!data?.ok) return;
        const fresh: Record<number, string> = data.notes;
        const { notes: curNotes, day: curDay } = stateRef.current;
        const curDraft = curNotes[curDay] ?? "";
        setNotes((n) => ({ ...n, ...fresh }));
        // ne pas écraser une saisie en cours sur le jour actif
        if ((fresh[curDay] ?? "") !== curDraft) {
          setDraft((d) => (d === curDraft ? fresh[curDay] ?? "" : d));
        }
        if (data.authors) setAuthors(data.authors);
      } catch {
        // ignore transient network errors, will retry on next tick
      }
    }, 5000);
    return () => clearInterval(id);
  }, [playerId]);

  async function persist() {
    setSaving(true);
    await fetch(`/api/players/${playerId}/remarks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day, note: draft }),
    });
    setNotes((n) => ({ ...n, [day]: draft }));
    setSaving(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  const savedValue = notes[day] ?? "";
  const authorName = authors[day];

  return (
    <div className="card postit-pink">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 800, color: "#831843" }}>📌 Remarque</div>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#9d174d" }}>
          {formatDayHeader(dateForDayIndex(startDate, day))}
        </span>
      </div>

      <p style={{ fontSize: 12, color: "#9d174d", marginTop: 0, marginBottom: 8 }}>
        Conseils ou observations du jour, sans lien avec un créneau précis.
      </p>
      {canEdit && authorName && (
        <p style={{ fontSize: 12, color: "#9d174d", fontStyle: "italic", marginTop: 0, marginBottom: 8, opacity: 0.8 }}>
          Écrit par {authorName}
        </p>
      )}

      {canEdit ? (
        <>
          <AutoGrowTextarea
            value={draft}
            onChange={setDraft}
            minHeight={64}
            placeholder="Écris une remarque pour ce jour…"
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
