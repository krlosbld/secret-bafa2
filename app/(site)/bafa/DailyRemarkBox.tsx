"use client";

import { useEffect, useRef, useState } from "react";
import { dateForDayIndex, formatDayHeader } from "@/lib/planningConfig";
import AutoGrowTextarea from "./AutoGrowTextarea";
import TextHistoryButton from "@/components/TextHistoryButton";

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
  const [conflictFlash, setConflictFlash] = useState(false);

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
    const base = stateRef.current.notes[day] ?? "";
    const res = await fetch(`/api/players/${playerId}/remarks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day, note: draft, base }),
    });
    const data = await res.json().catch(() => null);
    const finalNote = typeof data?.remark?.note === "string" ? data.remark.note : draft;
    setNotes((n) => ({ ...n, [day]: finalNote }));
    setDraft(finalNote);
    setSaving(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
    if (data?.merged) {
      setConflictFlash(true);
      setTimeout(() => setConflictFlash(false), 5000);
    }
  }

  const savedValue = notes[day] ?? "";
  const authorName = authors[day];

  return (
    <div className="card postit-pink">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 800, color: "#831843" }}>📌 Remarque</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#9d174d" }}>
            {formatDayHeader(dateForDayIndex(startDate, day))}
          </span>
          {canEdit && <TextHistoryButton entityType="dailyRemark" entityKey={`${playerId}:${day}`} onRestore={setDraft} />}
        </div>
      </div>

      <p style={{ fontSize: 12, color: "#9d174d", marginTop: 0, marginBottom: 8 }}>
        Conseils ou observations du jour, sans lien avec un créneau précis.
      </p>
      {canEdit && conflictFlash && (
        <p style={{ fontSize: 12, color: "#b45309", fontWeight: 700, marginTop: 0, marginBottom: 8 }}>
          ⚠️ Un autre formateur venait de modifier cette case — ton texte a été ajouté à la suite plutôt que de remplacer le sien.
        </p>
      )}
      {canEdit && authorName && savedValue.trim() && (
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
