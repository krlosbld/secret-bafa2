"use client";

import { useEffect, useRef, useState } from "react";
import DailyRemarkBox from "./DailyRemarkBox";
import AutoGrowTextarea from "./AutoGrowTextarea";

export type Notes = {
  personalNote: string;
  ems: string;
  emsVisible: boolean;
  retourEms: string;
  retourEmsVisible: boolean;
  complementaryNote: string;
  complementaryVisible: boolean;
  finalOpinion: string;
  finalAppraisal: string;
  finalAppraisalVisible: boolean;
};

const OPINION_LABELS: Record<string, string> = {
  EN_ATTENTE: "En attente",
  FAVORABLE: "Favorable",
  DEFAVORABLE: "Défavorable",
};

const OPINION_COLORS: Record<string, { color: string; background: string }> = {
  EN_ATTENTE: { color: "#64748b", background: "#f1f5f9" },
  FAVORABLE: { color: "#16a34a", background: "#dcfce7" },
  DEFAVORABLE: { color: "#dc2626", background: "#fef2f2" },
};

type TextField = "personalNote" | "ems" | "retourEms" | "complementaryNote" | "finalAppraisal";

export default function PlayerNotesPanel({
  playerId,
  canEditPersonal,
  canEditStaffNotes,
  initialNotes,
  startDate,
  activeDay,
  initialRemarks,
}: {
  playerId: string;
  canEditPersonal: boolean;
  canEditStaffNotes: boolean;
  initialNotes: Notes;
  startDate: string;
  activeDay: number;
  initialRemarks: Record<number, string>;
}) {
  const [notes, setNotes] = useState<Notes>(initialNotes);
  const [drafts, setDrafts] = useState<Record<TextField, string>>({
    personalNote: initialNotes.personalNote,
    ems: initialNotes.ems,
    retourEms: initialNotes.retourEms,
    complementaryNote: initialNotes.complementaryNote,
    finalAppraisal: initialNotes.finalAppraisal,
  });
  const [saving, setSaving] = useState<TextField | null>(null);
  const [savedFlash, setSavedFlash] = useState<TextField | null>(null);

  const stateRef = useRef({ notes, drafts });
  useEffect(() => {
    stateRef.current = { notes, drafts };
  }, [notes, drafts]);

  async function persist(field: TextField, value: string) {
    setSaving(field);
    await fetch(`/api/players/${playerId}/notes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    setNotes((n) => ({ ...n, [field]: value }));
    setSaving(null);
    setSavedFlash(field);
    setTimeout(() => setSavedFlash((v) => (v === field ? null : v)), 1500);
  }

  async function toggleVisible(field: "emsVisible" | "retourEmsVisible" | "complementaryVisible" | "finalAppraisalVisible", value: boolean) {
    setNotes((n) => ({ ...n, [field]: value }));
    await fetch(`/api/players/${playerId}/notes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
  }

  async function setOpinion(value: string) {
    setNotes((n) => ({ ...n, finalOpinion: value }));
    await fetch(`/api/players/${playerId}/notes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ finalOpinion: value }),
    });
  }

  useEffect(() => {
    const id = setInterval(async () => {
      const { notes: curNotes, drafts: curDrafts } = stateRef.current;

      const editable: TextField[] = [
        ...(canEditPersonal ? (["personalNote"] as TextField[]) : []),
        ...(canEditStaffNotes ? (["ems", "retourEms", "complementaryNote", "finalAppraisal"] as TextField[]) : []),
      ];
      for (const field of editable) {
        if (curDrafts[field] !== curNotes[field]) {
          await persist(field, curDrafts[field]);
        }
      }

      try {
        const res = await fetch(`/api/players/${playerId}/notes`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!data?.ok) return;

        const fresh: Notes = data.notes;
        const { notes: latestNotes, drafts: latestDrafts } = stateRef.current;
        const nextNotes = { ...latestNotes, ...fresh };
        const nextDrafts = { ...latestDrafts };
        let changed = false;

        (["personalNote", "ems", "retourEms", "complementaryNote", "finalAppraisal"] as TextField[]).forEach((field) => {
          const hasUnsavedEdit = latestDrafts[field] !== latestNotes[field];
          if (hasUnsavedEdit) return;
          if (nextDrafts[field] !== fresh[field]) {
            nextDrafts[field] = fresh[field];
            changed = true;
          }
        });

        setNotes(nextNotes);
        if (changed) setDrafts(nextDrafts);
      } catch {
        // ignore transient network errors, will retry on next tick
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, 5000);
    return () => clearInterval(id);
  }, [playerId]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <NoteBox
        title="Info personnelle"
        help="Écris ici ce que tu souhaites porter à la connaissance de l'équipe de formation."
        value={drafts.personalNote}
        savedValue={notes.personalNote}
        editable={canEditPersonal}
        visible={true}
        saving={saving === "personalNote"}
        justSaved={savedFlash === "personalNote"}
        onChange={(v) => setDrafts((d) => ({ ...d, personalNote: v }))}
        onSave={() => persist("personalNote", drafts.personalNote)}
      />

      <DailyRemarkBox
        playerId={playerId}
        day={activeDay}
        startDate={startDate}
        initialNotes={initialRemarks}
        canEdit={canEditStaffNotes}
      />

      <NoteBox
        title="EMS (entretien de mi-stage)"
        value={drafts.ems}
        savedValue={notes.ems}
        editable={canEditStaffNotes}
        visible={canEditStaffNotes || notes.emsVisible}
        saving={saving === "ems"}
        justSaved={savedFlash === "ems"}
        onChange={(v) => setDrafts((d) => ({ ...d, ems: v }))}
        onSave={() => persist("ems", drafts.ems)}
        visibleToggle={
          canEditStaffNotes
            ? { checked: notes.emsVisible, onChange: (v) => toggleVisible("emsVisible", v) }
            : undefined
        }
      />

      <NoteBox
        title="Retour EMS"
        value={drafts.retourEms}
        savedValue={notes.retourEms}
        editable={canEditStaffNotes}
        visible={canEditStaffNotes || notes.retourEmsVisible}
        saving={saving === "retourEms"}
        justSaved={savedFlash === "retourEms"}
        onChange={(v) => setDrafts((d) => ({ ...d, retourEms: v }))}
        onSave={() => persist("retourEms", drafts.retourEms)}
        visibleToggle={
          canEditStaffNotes
            ? { checked: notes.retourEmsVisible, onChange: (v) => toggleVisible("retourEmsVisible", v) }
            : undefined
        }
      />

      <NoteBox
        title="Entretien complémentaire"
        value={drafts.complementaryNote}
        savedValue={notes.complementaryNote}
        editable={canEditStaffNotes}
        visible={canEditStaffNotes || notes.complementaryVisible}
        saving={saving === "complementaryNote"}
        justSaved={savedFlash === "complementaryNote"}
        onChange={(v) => setDrafts((d) => ({ ...d, complementaryNote: v }))}
        onSave={() => persist("complementaryNote", drafts.complementaryNote)}
        visibleToggle={
          canEditStaffNotes
            ? { checked: notes.complementaryVisible, onChange: (v) => toggleVisible("complementaryVisible", v) }
            : undefined
        }
      />

      {(canEditStaffNotes || notes.finalAppraisalVisible) && (
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 800 }}>Avis</div>
          {canEditStaffNotes ? (
            <select
              value={notes.finalOpinion}
              onChange={(e) => setOpinion(e.target.value)}
              style={{ border: "1px solid #ddd", borderRadius: 8, padding: "6px 10px", fontSize: 14, fontWeight: 700 }}
            >
              {Object.entries(OPINION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          ) : (
            <span
              style={{
                fontSize: 13,
                fontWeight: 800,
                padding: "3px 10px",
                borderRadius: 999,
                ...OPINION_COLORS[notes.finalOpinion],
              }}
            >
              {OPINION_LABELS[notes.finalOpinion] ?? notes.finalOpinion}
            </span>
          )}
        </div>
      )}

      <NoteBox
        title="Appréciation finale"
        value={drafts.finalAppraisal}
        savedValue={notes.finalAppraisal}
        editable={canEditStaffNotes}
        visible={canEditStaffNotes || notes.finalAppraisalVisible}
        saving={saving === "finalAppraisal"}
        justSaved={savedFlash === "finalAppraisal"}
        onChange={(v) => setDrafts((d) => ({ ...d, finalAppraisal: v }))}
        onSave={() => persist("finalAppraisal", drafts.finalAppraisal)}
        showCharCount
        visibleToggle={
          canEditStaffNotes
            ? { checked: notes.finalAppraisalVisible, onChange: (v) => toggleVisible("finalAppraisalVisible", v) }
            : undefined
        }
      />
    </div>
  );
}

function NoteBox({
  title,
  help,
  value,
  savedValue,
  editable,
  visible,
  saving,
  justSaved,
  onChange,
  onSave,
  visibleToggle,
  showCharCount,
}: {
  title: string;
  help?: string;
  value: string;
  savedValue: string;
  editable: boolean;
  visible: boolean;
  saving: boolean;
  justSaved: boolean;
  onChange: (v: string) => void;
  onSave: () => void;
  visibleToggle?: { checked: boolean; onChange: (v: boolean) => void };
  showCharCount?: boolean;
}) {
  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontWeight: 800 }}>{title}</div>
          {showCharCount && editable && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: value.length > 999 ? "#dc2626" : "#94a3b8",
              }}
            >
              {value.length} caractère{value.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {visibleToggle && (
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
            <input type="checkbox" checked={visibleToggle.checked} onChange={(e) => visibleToggle.onChange(e.target.checked)} />
            Visible par le stagiaire
          </label>
        )}
      </div>

      {help && <p style={{ fontSize: 12, color: "#64748b", marginTop: 0, marginBottom: 8 }}>{help}</p>}

      {editable ? (
        <>
          <AutoGrowTextarea value={value} onChange={onChange} />
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 6 }}>
            {saving ? (
              <span style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>Enregistrement…</span>
            ) : justSaved ? (
              <span style={{ color: "#16a34a", fontSize: 12, fontWeight: 700 }}>Enregistré ✓</span>
            ) : value !== savedValue ? (
              <span style={{ color: "#94a3b8", fontSize: 12 }}>Sauvegarde automatique…</span>
            ) : null}
            <button
              className="btn btn-ghost"
              style={{ padding: "4px 12px", fontSize: 13 }}
              disabled={saving || value === savedValue}
              onClick={onSave}
            >
              Enregistrer maintenant
            </button>
          </div>
        </>
      ) : visible ? (
        <p style={{ color: value ? "#0f172a" : "#94a3b8", fontSize: 14, whiteSpace: "pre-wrap", margin: 0 }}>
          {value || "Rien pour l'instant."}
        </p>
      ) : (
        <p style={{ color: "#94a3b8", fontSize: 14, fontStyle: "italic", margin: 0 }}>Pas encore disponible.</p>
      )}
    </div>
  );
}
