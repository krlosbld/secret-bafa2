"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Réglages > colonnes du tableau « Stagiaires » : afficher / masquer, abréviation, libellé, ordre,
// et colonnes liées à un type de créneau du planning (nombre d'affectations du stagiaire).

type Column =
  | { id: string; kind: "poste"; posteTypeId: string; label: string; abbr: string; visible: boolean }
  | { id: string; kind: "ems" | "retourEms" | "complementary" | "finalAppraisal"; label: string; abbr: string; visible: boolean };
type Poste = { id: string; label: string };

function suggestAbbr(label: string): string {
  const words = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^A-Za-z0-9]+/)
    .filter((w) => w.length > 2 || /^[A-Z0-9]+$/.test(w));
  const abbr = (words.length > 1 ? words.map((w) => w[0]).join("") : (words[0] ?? label).slice(0, 3)).toUpperCase();
  return abbr.slice(0, 5) || "COL";
}

export default function StagiaireColumnsForm({ formationId, initial, postes }: { formationId: string; initial: Column[]; postes: Poste[] }) {
  const router = useRouter();
  const [columns, setColumns] = useState<Column[]>(initial);
  const [newPoste, setNewPoste] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const posteLabel = (id: string) => postes.find((p) => p.id === id)?.label ?? "Type supprimé";
  const update = (i: number, patch: Partial<Column>) => setColumns((cs) => cs.map((c, j) => (j === i ? ({ ...c, ...patch } as Column) : c)));
  const move = (i: number, d: -1 | 1) =>
    setColumns((cs) => {
      const j = i + d;
      if (j < 0 || j >= cs.length) return cs;
      const next = [...cs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  function addPoste() {
    const p = postes.find((x) => x.id === newPoste);
    if (!p) return;
    setColumns((cs) => [...cs, { id: `new-${Date.now()}`, kind: "poste", posteTypeId: p.id, label: p.label, abbr: suggestAbbr(p.label), visible: true }]);
    setNewPoste("");
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/sessions/${formationId}/columns`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setColumns(data.columns);
        setMessage({ ok: true, text: "Enregistré ✓" });
        router.refresh();
      } else setMessage({ ok: false, text: data.error || "Enregistrement impossible." });
    } catch {
      setMessage({ ok: false, text: "Connexion impossible." });
    }
    setSaving(false);
  }

  return (
    <div className="set-card" id="colonnes">
      <div className="set-card__head">
        <h2 className="set-card__title">Colonnes du tableau Stagiaires</h2>
        <p className="set-card__sub">
          <span className="set-kind set-kind--poste">Créneau</span> nombre d&apos;affectations au planning ·{" "}
          <span className="set-kind">Fiche</span> ✓ si rempli
        </p>
      </div>

      <div className="set-cols">
        {columns.map((c, i) => (
          <div key={c.id} className={`set-col${c.visible ? "" : " set-col--off"}`}>
            <input type="checkbox" checked={c.visible} onChange={(e) => update(i, { visible: e.target.checked })} aria-label={`Afficher ${c.abbr}`} />
            <input className="set-col__abbr" value={c.abbr} onChange={(e) => update(i, { abbr: e.target.value.slice(0, 5) })} aria-label="Abréviation" />
            <input
              className="set-col__label"
              value={c.label}
              onChange={(e) => update(i, { label: e.target.value.slice(0, 40) })}
              aria-label="Libellé"
              title={c.kind === "poste" ? `Créneau du planning : ${posteLabel(c.posteTypeId)}` : "Indicateur de la fiche : ✓ si rempli"}
            />
            <span className={`set-kind${c.kind === "poste" ? " set-kind--poste" : ""}`} title={c.kind === "poste" ? posteLabel(c.posteTypeId) : undefined}>
              {c.kind === "poste" ? "Créneau" : "Fiche"}
            </span>
            <span className="set-col__tools">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Monter" title="Monter">
                ↑
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === columns.length - 1} aria-label="Descendre" title="Descendre">
                ↓
              </button>
              <button
                type="button"
                onClick={() => setColumns((cs) => cs.filter((_, j) => j !== i))}
                disabled={c.kind !== "poste"}
                aria-label="Supprimer"
                title={c.kind === "poste" ? "Supprimer" : "Les indicateurs de la fiche se masquent avec la case à cocher"}
              >
                ✕
              </button>
            </span>
          </div>
        ))}
      </div>

      <div className="set-row set-row--add">
        <select value={newPoste} onChange={(e) => setNewPoste(e.target.value)} aria-label="Type de créneau à ajouter">
          <option value="">Ajouter une colonne de créneau…</option>
          {postes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-ghost" onClick={addPoste} disabled={!newPoste}>
          + Ajouter
        </button>
      </div>

      <div className="set-actions">
        <button type="button" className="btn btn-main" onClick={save} disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        {message && <span className={`set-msg${message.ok ? "" : " set-msg--error"}`}>{message.text}</span>}
      </div>
    </div>
  );
}
