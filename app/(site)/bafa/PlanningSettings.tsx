"use client";

import { useState } from "react";
import type { Poste, Criterion, CriterionStateDef } from "./PlanningTab";
import { DEFAULT_POSTE_CATEGORY, categoriesForSessionType } from "@/lib/planningConfig";

// Réglages « Planning et évaluations » (onglet ⚙️ Réglages, directeurs et admin) : les temps de
// formation du compte (sa liste BAFA ou BAFD, selon la session), les critères d'évaluation
// quotidiens (propres à la session) et leurs états (communs). Depuis le planning, on peut aussi
// créer un temps de formation.

type PostePatch = { label?: string; color?: string; evaluable?: boolean; category?: string; countedInHours?: boolean };
type AddPoste = (label: string, color: string, evaluable: boolean, category: string, countedInHours: boolean) => Promise<void>;

// Formulaire « nouveau temps de formation » (type de créneau) — Réglages et bouton du planning.
export function NewPosteForm({ categories, onAdd }: { categories: Record<string, string>; onAdd: AddPoste }) {
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#0f766e");
  const [newEvaluable, setNewEvaluable] = useState(false);
  const [newCategory, setNewCategory] = useState(DEFAULT_POSTE_CATEGORY);
  const [newCountedInHours, setNewCountedInHours] = useState(true);
  const [busy, setBusy] = useState(false);

  async function handleAdd() {
    if (!newLabel.trim()) return;
    setBusy(true);
    await onAdd(newLabel.trim(), newColor, newEvaluable, newCategory, newCountedInHours);
    setNewLabel("");
    setNewEvaluable(false);
    setNewCategory(DEFAULT_POSTE_CATEGORY);
    setNewCountedInHours(true);
    setBusy(false);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <input
        type="color"
        value={newColor}
        onChange={(e) => setNewColor(e.target.value)}
        style={{ flex: "none", width: 32, height: 32, padding: 0, border: "none", borderRadius: 6, cursor: "pointer" }}
      />
      <input
        value={newLabel}
        onChange={(e) => setNewLabel(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        placeholder="Nouveau temps de formation…"
        style={{ flex: 1, minWidth: 160, border: "1px solid #ddd", borderRadius: 8, padding: "6px 8px", fontSize: 14 }}
      />
      <select
        value={newCategory}
        onChange={(e) => setNewCategory(e.target.value)}
        style={{ border: "1px solid #ddd", borderRadius: 6, padding: "5px 6px", fontSize: 12 }}
      >
        {Object.entries(categories).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#475569", whiteSpace: "nowrap" }}>
        <input type="checkbox" checked={newEvaluable} onChange={(e) => setNewEvaluable(e.target.checked)} />
        Évaluable
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#475569", whiteSpace: "nowrap" }}>
        <input type="checkbox" checked={newCountedInHours} onChange={(e) => setNewCountedInHours(e.target.checked)} />
        Compte dans le total
      </label>
      <button className="btn btn-main" onClick={handleAdd} disabled={busy || !newLabel.trim()} style={{ padding: "6px 12px" }}>
        + Ajouter
      </button>
    </div>
  );
}

export default function PlanningSettings({
  initialPostes,
  family,
  hasOwner,
  initialCriteria,
  initialCriterionStates,
  sessionType,
  canEditLegacyStates,
}: {
  initialPostes: Poste[];
  family: "BAFA" | "BAFD";
  hasOwner: boolean;
  initialCriteria: Criterion[];
  initialCriterionStates: CriterionStateDef[];
  sessionType: string;
  canEditLegacyStates: boolean; // anciens états, communs à toutes les sessions : super-admin seulement
}) {
  const [postes, setPostes] = useState<Poste[]>(initialPostes);
  const [criteria, setCriteria] = useState<Criterion[]>(initialCriteria);
  const [criterionStates, setCriterionStates] = useState<CriterionStateDef[]>(initialCriterionStates);
  const posteCategories = categoriesForSessionType(sessionType);

  async function addPoste(label: string, color: string, evaluable: boolean, category: string, countedInHours: boolean) {
    const tmpId = `tmp-${Date.now()}`;
    setPostes((ps) => [...ps, { id: tmpId, label, color, order: ps.length, evaluable, category, countedInHours }]);
    const res = await fetch("/api/planning/postes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, color, evaluable, category, countedInHours }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.poste) {
      setPostes((ps) => ps.map((p) => (p.id === tmpId ? data.poste : p)));
    } else {
      setPostes((ps) => ps.filter((p) => p.id !== tmpId));
    }
  }

  async function updatePoste(id: string, patch: PostePatch) {
    setPostes((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    await fetch(`/api/planning/postes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function removePoste(id: string): Promise<string | null> {
    const res = await fetch(`/api/planning/postes/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error || "Erreur.";
    setPostes((ps) => ps.filter((p) => p.id !== id));
    return null;
  }

  async function addCriterion(label: string) {
    const res = await fetch("/api/criteria", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.criterion) setCriteria((cs) => [...cs, data.criterion]);
  }

  async function reloadCriteria() {
    const res = await fetch("/api/criteria/usage", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.criteria) setCriteria(data.criteria);
  }

  // Toute modification d'un critère existant passe par le serveur, puis la liste est rechargée.
  async function patchCriterion(id: string, patch: Record<string, unknown>): Promise<{ error?: string; needsChoice?: boolean; ratingCount?: number }> {
    const res = await fetch(`/api/criteria/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error || "Erreur.", needsChoice: !!data.needsChoice, ratingCount: data.ratingCount };
    await reloadCriteria();
    return {};
  }

  async function removeCriterion(id: string): Promise<string | null> {
    const res = await fetch(`/api/criteria/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error || "Erreur.";
    setCriteria((cs) => cs.filter((c) => c.id !== id));
    return null;
  }

  async function addCriterionState(label: string, color: string, score: number | null) {
    const tmpId = `tmp-${Date.now()}`;
    setCriterionStates((ss) => [...ss, { id: tmpId, label, color, score, order: ss.length }]);
    const res = await fetch("/api/criterion-states", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, color, score }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.state) {
      setCriterionStates((ss) => ss.map((s) => (s.id === tmpId ? data.state : s)));
    } else {
      setCriterionStates((ss) => ss.filter((s) => s.id !== tmpId));
    }
  }

  async function updateCriterionState(id: string, patch: { label?: string; color?: string; score?: number | null }) {
    setCriterionStates((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    await fetch(`/api/criterion-states/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function removeCriterionState(id: string): Promise<string | null> {
    const res = await fetch(`/api/criterion-states/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error || "Erreur.";
    setCriterionStates((ss) => ss.filter((s) => s.id !== id));
    return null;
  }

  return (
    <div className="set-grid set-grid--planning">
      <section className="set-card">
        <div className="set-card__head">
          <h2 className="set-card__title">Temps de formation</h2>
          <p className="set-card__sub">
            Votre liste personnelle pour les sessions {family === "BAFD" ? "BAFD (BAFD 1, BAFD 3)" : "BAFA (BAFA 1, BAFA 3)"} : ce que vous
            ajoutez ou modifiez ici ne change rien pour les autres comptes.
          </p>
        </div>
        {hasOwner ? (
          <PosteManager postes={postes} categories={posteCategories} onAdd={addPoste} onUpdate={updatePoste} onRemove={removePoste} />
        ) : (
          <p className="set-card__sub">Aucun directeur n&apos;est rattaché à cette session : les temps de formation appartiennent à un compte.</p>
        )}
      </section>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <section className="set-card">
          <div className="set-card__head">
            <h2 className="set-card__title">Critères d&apos;évaluation quotidiens</h2>
            <p className="set-card__sub">Notés chaque jour sur la fiche de chaque stagiaire. Propres à cette session.</p>
          </div>
          <CriteriaManager criteria={criteria} onAdd={addCriterion} onPatch={patchCriterion} onRemove={removeCriterion} />
        </section>
        {canEditLegacyStates && (
          <section className="set-card">
            <div className="set-card__head">
              <h2 className="set-card__title">États de notation des critères</h2>
              <p className="set-card__sub">Communs à toutes les sessions : une modification change la lecture des appréciations déjà enregistrées partout.</p>
            </div>
            <CriterionStateManager
              states={criterionStates}
              onAdd={addCriterionState}
              onUpdate={updateCriterionState}
              onRemove={removeCriterionState}
            />
          </section>
        )}
      </div>
    </div>
  );
}

function PosteManager({
  postes,
  categories,
  onAdd,
  onUpdate,
  onRemove,
}: {
  postes: Poste[];
  categories: Record<string, string>;
  onAdd: AddPoste;
  onUpdate: (id: string, patch: PostePatch) => Promise<void>;
  onRemove: (id: string) => Promise<string | null>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function handleRemove(id: string) {
    setError(null);
    setBusy(id);
    const err = await onRemove(id);
    if (err) setError(err);
    setBusy(null);
  }

  return (
    <div>
      <p style={{ fontSize: 12, color: "#64748b", marginTop: 0, marginBottom: 10 }}>
        Coche « Évaluable » pour qu&apos;une case d&apos;évaluation par stagiaire apparaisse automatiquement sur chaque créneau de ce type.
      </p>
      {postes.length === 0 && (
        <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px" }}>Aucun temps de formation pour l&apos;instant : créez le premier ci-dessous.</p>
      )}
      <div className="set-postes">
        {postes.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <input
              type="color"
              value={p.color}
              onChange={(e) => onUpdate(p.id, { color: e.target.value })}
              style={{ flex: "none", width: 32, height: 32, padding: 0, border: "none", borderRadius: 6, cursor: "pointer" }}
            />
            <input
              value={p.label}
              onChange={(e) => onUpdate(p.id, { label: e.target.value })}
              style={{ flex: 1, minWidth: 140, border: "1px solid #ddd", borderRadius: 8, padding: "6px 8px", fontSize: 14 }}
            />
            <select
              value={p.category}
              onChange={(e) => onUpdate(p.id, { category: e.target.value })}
              style={{ border: "1px solid #ddd", borderRadius: 6, padding: "5px 6px", fontSize: 12 }}
            >
              {Object.entries(categories).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#475569", whiteSpace: "nowrap" }}>
              <input
                type="checkbox"
                checked={p.evaluable}
                onChange={(e) => onUpdate(p.id, { evaluable: e.target.checked })}
              />
              Évaluable
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#475569", whiteSpace: "nowrap" }}>
              <input
                type="checkbox"
                checked={p.countedInHours}
                onChange={(e) => onUpdate(p.id, { countedInHours: e.target.checked })}
              />
              Compte dans le total
            </label>
            <button
              onClick={() => handleRemove(p.id)}
              disabled={busy === p.id}
              className="btn btn-ghost"
              style={{ padding: "4px 10px", color: "#dc2626" }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      {postes.length > 7 && (
        <p style={{ fontSize: 12, color: "#94a3b8", margin: "-4px 0 12px" }}>
          {postes.length} temps de formation · faites défiler la liste pour voir les autres
        </p>
      )}

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: 10, color: "#dc2626", fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
          {error}
        </div>
      )}

      <NewPosteForm categories={categories} onAdd={onAdd} />
    </div>
  );
}

const crInput = { flex: 1, minWidth: 140, border: "1px solid #ddd", borderRadius: 8, padding: "6px 8px", fontSize: 14 } as const;
const crSmall = { padding: "4px 9px", fontSize: 12 } as const;

type PatchResult = { error?: string; needsChoice?: boolean; ratingCount?: number };

function CriteriaManager({
  criteria,
  onAdd,
  onPatch,
  onRemove,
}: {
  criteria: Criterion[];
  onAdd: (label: string) => Promise<void>;
  onPatch: (id: string, patch: Record<string, unknown>) => Promise<PatchResult>;
  onRemove: (id: string) => Promise<string | null>;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Renommage en cours : saisie libre, rien n'est envoyé avant « Enregistrer ».
  const [editing, setEditing] = useState<{ id: string; label: string; choice?: number } | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const active = criteria.filter((c) => !c.archived);
  const archived = criteria.filter((c) => c.archived);

  async function run(id: string, action: () => Promise<string | null | undefined>) {
    setError(null);
    setBusy(id);
    const err = await action();
    if (err) setError(err);
    setBusy(null);
  }

  async function handleAdd() {
    if (!newLabel.trim()) return;
    await run("new", async () => {
      await onAdd(newLabel.trim());
      setNewLabel("");
      return null;
    });
  }

  async function saveRename(renameMode?: "correct" | "archive_and_create") {
    if (!editing || !editing.label.trim()) return;
    const { id, label } = editing;
    await run(id, async () => {
      const r = await onPatch(id, { label: label.trim(), ...(renameMode ? { renameMode } : {}) });
      if (r.needsChoice) {
        setEditing({ id, label, choice: r.ratingCount ?? 0 });
        return null;
      }
      if (!r.error) setEditing(null);
      return r.error;
    });
  }

  function confirmArchive(c: Criterion) {
    if (!window.confirm(`Archiver « ${c.label} » ?\n\nIl ne sera plus proposé à la saisie. Ses ${c.ratingCount ?? 0} appréciation(s) restent consultables sur les fiches et dans les PDF.`)) return;
    run(c.id, async () => (await onPatch(c.id, { archived: true })).error);
  }

  return (
    <div>
      <p style={{ fontSize: 12, color: "#64748b", marginTop: 0, marginBottom: 10 }}>
        Ces critères apparaissent chaque jour sur la fiche de chaque stagiaire. Un critère déjà apprécié ne se supprime pas : il
        s&apos;archive, et ses appréciations restent consultables.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {active.map((c, i) => {
          const isEditing = editing?.id === c.id;
          const used = (c.ratingCount ?? 0) > 0;
          return (
            <div key={c.id} style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {isEditing ? (
                  <input
                    autoFocus
                    value={editing.label}
                    onChange={(e) => setEditing({ id: c.id, label: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename();
                      if (e.key === "Escape") setEditing(null);
                    }}
                    maxLength={100}
                    style={crInput}
                  />
                ) : (
                  <span style={{ flex: 1, minWidth: 140, fontSize: 14, fontWeight: 600 }}>
                    {c.label}
                    {used && <span style={{ fontWeight: 400, fontSize: 12, color: "#94a3b8" }}> · {c.ratingCount} appréciation(s)</span>}
                  </span>
                )}
                {isEditing ? (
                  <>
                    <button className="btn btn-main" style={crSmall} disabled={busy === c.id || !editing.label.trim()} onClick={() => saveRename()}>
                      Enregistrer
                    </button>
                    <button className="btn btn-ghost" style={crSmall} onClick={() => setEditing(null)}>
                      Annuler
                    </button>
                  </>
                ) : (
                  <>
                    <button className="btn btn-ghost" style={crSmall} title="Monter" aria-label="Monter" disabled={i === 0 || !!busy} onClick={() => run(c.id, async () => (await onPatch(c.id, { move: "up" })).error)}>
                      ↑
                    </button>
                    <button className="btn btn-ghost" style={crSmall} title="Descendre" aria-label="Descendre" disabled={i === active.length - 1 || !!busy} onClick={() => run(c.id, async () => (await onPatch(c.id, { move: "down" })).error)}>
                      ↓
                    </button>
                    <button className="btn btn-ghost" style={crSmall} onClick={() => setEditing({ id: c.id, label: c.label })}>
                      Renommer
                    </button>
                    {used ? (
                      <button className="btn btn-ghost" style={crSmall} disabled={busy === c.id} onClick={() => confirmArchive(c)}>
                        Archiver
                      </button>
                    ) : (
                      <button className="btn btn-ghost" style={{ ...crSmall, color: "#dc2626" }} title="Supprimer" aria-label="Supprimer" disabled={busy === c.id} onClick={() => run(c.id, () => onRemove(c.id))}>
                        ✕
                      </button>
                    )}
                  </>
                )}
              </div>
              {isEditing && editing.choice !== undefined && (
                <div style={{ marginTop: 8, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 10, fontSize: 13 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>
                    « {c.label} » porte déjà {editing.choice} appréciation(s). Que voulez-vous faire ?
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <button className="btn btn-main" style={{ ...crSmall, textAlign: "left" }} disabled={busy === c.id} onClick={() => saveRename("correct")}>
                      Corriger l&apos;intitulé — c&apos;est le même critère (orthographe, formulation)
                    </button>
                    <button className="btn btn-ghost" style={{ ...crSmall, textAlign: "left" }} disabled={busy === c.id} onClick={() => saveRename("archive_and_create")}>
                      Archiver ce critère et créer « {editing.label.trim()} » — c&apos;est un critère différent
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: 10, color: "#dc2626", fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Nouveau critère…" maxLength={100} style={crInput} />
        <button className="btn btn-main" onClick={handleAdd} disabled={busy === "new" || !newLabel.trim()} style={{ padding: "6px 12px" }}>
          + Ajouter
        </button>
      </div>

      {archived.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <button className="btn btn-ghost" style={crSmall} onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? "▾" : "▸"} Critères archivés ({archived.length})
          </button>
          {showArchived && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {archived.map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748b", fontSize: 14 }}>
                  <span style={{ flex: 1 }}>
                    {c.label}
                    {(c.ratingCount ?? 0) > 0 && <span style={{ fontSize: 12 }}> · {c.ratingCount} appréciation(s)</span>}
                  </span>
                  <button className="btn btn-ghost" style={crSmall} disabled={busy === c.id} onClick={() => run(c.id, async () => (await onPatch(c.id, { archived: false })).error)}>
                    Réactiver
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CriterionStateManager({
  states,
  onAdd,
  onUpdate,
  onRemove,
}: {
  states: CriterionStateDef[];
  onAdd: (label: string, color: string, score: number | null) => Promise<void>;
  onUpdate: (id: string, patch: { label?: string; color?: string; score?: number | null }) => Promise<void>;
  onRemove: (id: string) => Promise<string | null>;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#0f766e");
  const [newScore, setNewScore] = useState("0");
  const [newExcluded, setNewExcluded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function handleAdd() {
    if (!newLabel.trim()) return;
    setBusy("new");
    await onAdd(newLabel.trim(), newColor, newExcluded ? null : Number(newScore));
    setNewLabel("");
    setNewScore("0");
    setNewExcluded(false);
    setBusy(null);
  }

  async function handleRemove(id: string) {
    setError(null);
    setBusy(id);
    const err = await onRemove(id);
    if (err) setError(err);
    setBusy(null);
  }

  return (
    <div>
      <p style={{ fontSize: 12, color: "#64748b", marginTop: 0, marginBottom: 10 }}>
        Le score (-1 à 2, n&apos;importe quelle valeur décimale) détermine le sens et la couleur de la flèche de tendance
        quotidienne. Coche « Exclure » pour un état comme « Non observé » qui ne doit pas compter dans le calcul.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {states.map((s) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <input
              type="color"
              value={s.color}
              onChange={(e) => onUpdate(s.id, { color: e.target.value })}
              style={{ flex: "none", width: 32, height: 32, padding: 0, border: "none", borderRadius: 6, cursor: "pointer" }}
            />
            <input
              value={s.label}
              onChange={(e) => onUpdate(s.id, { label: e.target.value })}
              style={{ flex: 1, minWidth: 140, border: "1px solid #ddd", borderRadius: 8, padding: "6px 8px", fontSize: 14 }}
            />
            <input
              type="number"
              min={-1}
              max={2}
              step={0.05}
              value={s.score ?? ""}
              disabled={s.score === null}
              onChange={(e) => onUpdate(s.id, { score: Number(e.target.value) })}
              style={{ width: 56, border: "1px solid #ddd", borderRadius: 8, padding: "6px 4px", fontSize: 13 }}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#475569", whiteSpace: "nowrap" }}>
              <input
                type="checkbox"
                checked={s.score === null}
                onChange={(e) => onUpdate(s.id, { score: e.target.checked ? null : 0 })}
              />
              Exclure
            </label>
            <button
              onClick={() => handleRemove(s.id)}
              disabled={busy === s.id}
              className="btn btn-ghost"
              style={{ padding: "4px 10px", color: "#dc2626" }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: 10, color: "#dc2626", fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <input
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          style={{ flex: "none", width: 32, height: 32, padding: 0, border: "none", borderRadius: 6, cursor: "pointer" }}
        />
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Nouvel état…"
          style={{ flex: 1, minWidth: 140, border: "1px solid #ddd", borderRadius: 8, padding: "6px 8px", fontSize: 14 }}
        />
        <input
          type="number"
          min={-1}
          max={2}
          step={0.05}
          value={newScore}
          disabled={newExcluded}
          onChange={(e) => setNewScore(e.target.value)}
          style={{ width: 56, border: "1px solid #ddd", borderRadius: 8, padding: "6px 4px", fontSize: 13 }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#475569", whiteSpace: "nowrap" }}>
          <input type="checkbox" checked={newExcluded} onChange={(e) => setNewExcluded(e.target.checked)} />
          Exclure
        </label>
        <button className="btn btn-main" onClick={handleAdd} disabled={busy === "new" || !newLabel.trim()} style={{ padding: "6px 12px" }}>
          + Ajouter
        </button>
      </div>
    </div>
  );
}
