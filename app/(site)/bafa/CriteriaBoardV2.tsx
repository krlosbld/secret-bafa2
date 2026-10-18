"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Criterion } from "./PlanningTab";
import type { CriterionState } from "./CriteriaBoard";

// Saisie par critère, nouvelle méthode (EVALUATION_V2) : 3 appréciations propres à la session.
// - La justification « Que doit approfondir le stagiaire ? » est obligatoire au niveau technique 1,
//   quel que soit l'intitulé choisi par le directeur ; le commentaire est facultatif aux niveaux 2 et 3.
// - Chaque écriture porte la version lue : si quelqu'un a modifié l'appréciation entre-temps, le
//   serveur refuse (409), on l'explique et on recharge la version actuelle au lieu d'écraser.
// - Une appréciation de l'ancienne méthode reste affichée avec son intitulé d'origine ; la remplacer
//   est un choix explicite (l'ancienne valeur reste dans l'historique de l'équipe).

export type RatingLevelDef = { level: number; label: string };
export type RatingDetail = { level: number | null; comment: string | null };
export type RatingMeta = { version: number; author: string | null };

const LEVEL_COLOR: Record<number, string> = { 3: "#0f766e", 2: "#2563eb", 1: "#c2410c" };
const JUSTIFICATION_LEVEL = 1;

type Snapshot = {
  values: Record<string, string>;
  details: Record<string, RatingDetail>;
  meta: Record<string, RatingMeta>;
};

export default function CriteriaBoardV2({
  criteria,
  levels,
  legacyStates,
  activeDay,
  initialValues,
  initialDetails,
  initialMeta,
  canEdit,
  playerId,
}: {
  criteria: Criterion[];
  levels: RatingLevelDef[];
  legacyStates: CriterionState[];
  activeDay: number;
  initialValues: Record<string, string>;
  initialDetails: Record<string, RatingDetail>;
  initialMeta: Record<string, RatingMeta>;
  canEdit: boolean;
  playerId: string;
}) {
  const [snap, setSnap] = useState<Snapshot>({ values: initialValues, details: initialDetails, meta: initialMeta });
  // Clés en cours d'écriture ou de rédaction : le rafraîchissement automatique ne les touche pas.
  const lockedRef = useRef<Set<string>>(new Set());

  const reload = useCallback(
    async (force: string[] = []) => {
      try {
        const res = await fetch(`/api/ratings?playerId=${playerId}`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!data?.ok) return;
        setSnap((cur) => {
          const next: Snapshot = { values: { ...cur.values }, details: { ...cur.details }, meta: { ...cur.meta } };
          const keys = new Set([...Object.keys(cur.values), ...Object.keys(data.values)]);
          for (const key of keys) {
            if (lockedRef.current.has(key) && !force.includes(key)) continue;
            if (key in data.values) {
              next.values[key] = data.values[key];
              next.details[key] = data.details?.[key] ?? { level: null, comment: null };
              if (data.meta?.[key]) next.meta[key] = data.meta[key];
            } else {
              delete next.values[key];
              delete next.details[key];
              delete next.meta[key];
            }
          }
          return next;
        });
      } catch {
        // réseau momentanément indisponible : nouvel essai au prochain passage
      }
    },
    [playerId]
  );

  useEffect(() => {
    const id = setInterval(() => reload(), 5000);
    return () => clearInterval(id);
  }, [reload]);

  const shown = criteria.filter((c) => !c.archived || snap.values[`${c.id}:${activeDay}`]);
  if (shown.length === 0) {
    return <p style={{ color: "#64748b", fontSize: 14 }}>Aucun critère configuré.</p>;
  }

  const sortedLevels = [...levels].sort((a, b) => b.level - a.level);

  return (
    <div className="card">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {shown.map((c) => {
          const key = `${c.id}:${activeDay}`;
          return (
            <CriterionRow
              key={key}
              criterion={c}
              ratingKey={key}
              day={activeDay}
              playerId={playerId}
              levels={sortedLevels}
              legacyStates={legacyStates}
              value={snap.values[key]}
              detail={snap.details[key]}
              meta={snap.meta[key]}
              canEdit={canEdit && !c.archived}
              lock={(on) => (on ? lockedRef.current.add(key) : lockedRef.current.delete(key))}
              onSaved={(rating) =>
                setSnap((cur) => {
                  const next: Snapshot = { values: { ...cur.values }, details: { ...cur.details }, meta: { ...cur.meta } };
                  if (rating) {
                    next.values[key] = rating.value;
                    next.details[key] = { level: rating.level, comment: rating.comment };
                    next.meta[key] = { version: rating.version, author: rating.authorLabel };
                  } else {
                    delete next.values[key];
                    delete next.details[key];
                    delete next.meta[key];
                  }
                  return next;
                })
              }
              onConflict={() => reload([key])}
            />
          );
        })}
      </div>
    </div>
  );
}

type SavedRating = { value: string; level: number | null; comment: string | null; version: number; authorLabel: string | null };

function CriterionRow({
  criterion,
  ratingKey,
  day,
  playerId,
  levels,
  legacyStates,
  value,
  detail,
  meta,
  canEdit,
  lock,
  onSaved,
  onConflict,
}: {
  criterion: Criterion;
  ratingKey: string;
  day: number;
  playerId: string;
  levels: RatingLevelDef[];
  legacyStates: CriterionState[];
  value: string | undefined;
  detail: RatingDetail | undefined;
  meta: RatingMeta | undefined;
  canEdit: boolean;
  lock: (on: boolean) => void;
  onSaved: (rating: SavedRating | null) => void;
  onConflict: () => void;
}) {
  const currentLevel = detail?.level ?? null;
  const legacy = value && currentLevel === null ? legacyStates.find((s) => s.id === value) : undefined;
  const comment = detail?.comment ?? "";
  // Rédaction en cours : niveau visé (obligatoire en 1) et texte.
  const [draft, setDraft] = useState<{ level: number; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function openDraft(level: number, text: string) {
    lock(true);
    setDraft({ level, text });
  }
  function closeDraft() {
    setDraft(null);
    lock(false);
  }

  async function send(method: "POST" | "DELETE", body: Record<string, unknown>) {
    setBusy(true);
    setMessage(null);
    lock(true);
    try {
      const res = await fetch("/api/ratings", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, criterionId: criterion.id, day, expectedVersion: meta?.version ?? 0, ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setMessage(
          `Cette appréciation vient d'être modifiée${data.author ? ` par ${data.author}` : ""} : votre saisie n'a pas été enregistrée. La version actuelle est affichée ci-dessus.`
        );
        setDraft(null);
        lock(false);
        onConflict();
        return false;
      }
      if (!res.ok) {
        setMessage(data.error || "Enregistrement impossible.");
        return false;
      }
      onSaved(method === "DELETE" ? null : data.rating);
      setDraft(null);
      lock(false);
      return true;
    } catch {
      setMessage("Connexion impossible : rien n'a été enregistré.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function choose(level: number) {
    if (currentLevel === level) {
      if (!window.confirm(`Retirer l'appréciation « ${levels.find((l) => l.level === level)?.label} »${comment ? " et son commentaire" : ""} ?`)) return;
      void send("DELETE", {});
      return;
    }
    if (legacy && !window.confirm(`Remplacer l'appréciation de l'ancienne méthode « ${legacy.label} » ? Elle restera visible dans l'historique de l'équipe.`)) return;
    if (level === JUSTIFICATION_LEVEL) {
      openDraft(level, comment);
      return;
    }
    void send("POST", { level, comment });
  }

  const draftLabel = draft ? levels.find((l) => l.level === draft.level)?.label : "";
  const draftRequired = draft?.level === JUSTIFICATION_LEVEL;
  const currentLabel = levels.find((l) => l.level === currentLevel)?.label;

  return (
    <div data-criterion={criterion.id}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
        {criterion.label}
        {criterion.archived && <span style={{ fontWeight: 600, fontSize: 12, color: "#94a3b8" }}> · critère archivé</span>}
      </div>

      {legacy && (
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
          Ancienne méthode d&apos;évaluation : <strong style={{ color: "#334155" }}>{legacy.label}</strong>
        </div>
      )}

      {canEdit ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {levels.map((l) => {
            const active = (draft ? draft.level : currentLevel) === l.level;
            const color = LEVEL_COLOR[l.level] ?? "#475569";
            return (
              <button
                key={l.level}
                type="button"
                disabled={busy}
                aria-pressed={active}
                onClick={() => choose(l.level)}
                style={{
                  background: active ? color : "#fff",
                  color: active ? "#fff" : "#475569",
                  border: `2px solid ${active ? color : "#e2e8f0"}`,
                  borderRadius: 10,
                  padding: "5px 11px",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: busy ? "wait" : "pointer",
                }}
              >
                {l.label}
              </button>
            );
          })}
        </div>
      ) : (
        !legacy && (
          <span
            style={{
              display: "inline-block",
              background: currentLabel ? LEVEL_COLOR[currentLevel!] : "#fff",
              color: currentLabel ? "#fff" : "#94a3b8",
              border: `2px solid ${currentLabel ? LEVEL_COLOR[currentLevel!] : "#e2e8f0"}`,
              borderRadius: 10,
              padding: "5px 10px",
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            {currentLabel ?? "Pas encore apprécié"}
          </span>
        )
      )}

      {draft ? (
        <div style={{ marginTop: 8 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: draftRequired ? "#9a3412" : "#475569", marginBottom: 4 }}>
            {draftRequired ? `${draftLabel} — Que doit approfondir le stagiaire ? (obligatoire)` : "Commentaire (facultatif)"}
          </label>
          <textarea
            autoFocus
            value={draft.text}
            maxLength={2000}
            rows={2}
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 8px", fontSize: 14, fontFamily: "inherit", resize: "vertical" }}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <button
              type="button"
              className="btn btn-main"
              style={{ padding: "4px 12px", fontSize: 12 }}
              disabled={busy || (draftRequired && !draft.text.trim())}
              onClick={() => send("POST", { level: draft.level, comment: draft.text })}
            >
              Enregistrer
            </button>
            <button type="button" className="btn btn-ghost" style={{ padding: "4px 12px", fontSize: 12 }} disabled={busy} onClick={closeDraft}>
              Annuler
            </button>
          </div>
        </div>
      ) : (
        currentLevel !== null && (
          <div style={{ marginTop: 6 }}>
            {comment && (
              <div
                style={{
                  fontSize: 13,
                  whiteSpace: "pre-wrap",
                  background: currentLevel === JUSTIFICATION_LEVEL ? "#fff7ed" : "#f8fafc",
                  borderRadius: 8,
                  padding: "6px 9px",
                }}
              >
                <span style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.4 }}>
                  {currentLevel === JUSTIFICATION_LEVEL ? "À approfondir" : "Commentaire"}
                </span>
                {comment}
              </div>
            )}
            {canEdit && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => openDraft(currentLevel, comment)}
                  style={{ background: "none", border: "none", padding: 0, color: "#0f766e", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  {comment ? "Modifier le commentaire" : "Ajouter un commentaire"}
                </button>
                {meta?.author && <span style={{ fontSize: 11, color: "#94a3b8" }}>· {meta.author}</span>}
                <RatingHistoryButton playerId={playerId} criterionId={criterion.id} day={day} ratingKey={ratingKey} />
              </div>
            )}
          </div>
        )
      )}

      {message && (
        <div role="alert" style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "6px 9px" }}>
          {message}
        </div>
      )}
    </div>
  );
}

// Historique technique d'une appréciation : équipe seulement (l'API refuse le stagiaire).
function RatingHistoryButton({ playerId, criterionId, day, ratingKey }: { playerId: string; criterionId: string; day: number; ratingKey: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<
    { id: string; action: string; previous: string | null; next: string | null; previousComment: string | null; newComment: string | null; author: string | null; changedAt: string }[] | null
  >(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetch(`/api/ratings/history?playerId=${playerId}&criterionId=${criterionId}&day=${day}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => alive && setRows(d.ok ? d.history : []))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [open, playerId, criterionId, day]);

  const ACTION: Record<string, string> = { CREATE: "Création", UPDATE: "Modification", DELETE: "Retrait" };
  return (
    <>
      <button
        type="button"
        title="Historique de cette appréciation"
        aria-label="Historique de cette appréciation"
        data-key={ratingKey}
        onClick={() => {
          setRows(null);
          setOpen(true);
        }}
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#94a3b8", padding: 0 }}
      >
        🕘
      </button>
      {open && (
        <div className="sb-backdrop" onMouseDown={() => setOpen(false)}>
          <div className="sb-modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 480, maxHeight: "80vh", overflowY: "auto" }}>
            <div className="sb-modal__header">
              <h2>Historique de l&apos;appréciation</h2>
              <button className="sb-x" onClick={() => setOpen(false)} aria-label="Fermer">
                ✕
              </button>
            </div>
            {!rows ? (
              <p className="sb-help">Chargement…</p>
            ) : rows.length === 0 ? (
              <p className="sb-help">Aucun historique.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {rows.map((h) => (
                  <div key={h.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 9, fontSize: 13 }}>
                    <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>
                      {new Date(h.changedAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })} · {ACTION[h.action] ?? h.action}
                      {h.author && <> · {h.author}</>}
                    </div>
                    <div>
                      {h.previous ?? "—"} → <strong>{h.next ?? "—"}</strong>
                    </div>
                    {h.previousComment !== h.newComment && (
                      <div style={{ color: "#475569", marginTop: 4, whiteSpace: "pre-wrap" }}>
                        Commentaire : {h.previousComment || "—"} → {h.newComment || "—"}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
