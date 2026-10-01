"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Réglages > « Colonnes de la vue Stagiaires » : afficher / masquer, libellé, abréviation, ordre,
// et colonnes liées à un type de créneau du planning (nombre d'affectations du stagiaire).

type Column =
  | { id: string; kind: "poste"; posteTypeId: string; label: string; abbr: string; visible: boolean }
  | { id: string; kind: "ems" | "retourEms" | "complementary" | "finalAppraisal"; label: string; abbr: string; visible: boolean };
type Poste = { id: string; label: string };

const INDICATOR_HELP = "Indicateur de la fiche : ✓ si rempli";

function suggestAbbr(label: string): string {
  const words = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^A-Za-z0-9]+/)
    .filter((w) => w.length > 2 || /^[A-Z0-9]+$/.test(w));
  const abbr = (words.length > 1 ? words.map((w) => w[0]).join("") : (words[0] ?? label).slice(0, 3)).toUpperCase();
  return abbr.slice(0, 5) || "COL";
}

const input: React.CSSProperties = { border: "1px solid #ddd", borderRadius: 8, padding: "7px 9px", fontSize: 13, minWidth: 0 };

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
        setMessage({ ok: true, text: "Colonnes enregistrées ✓" });
        router.refresh();
      } else setMessage({ ok: false, text: data.error || "Enregistrement impossible." });
    } catch {
      setMessage({ ok: false, text: "Connexion impossible." });
    }
    setSaving(false);
  }

  return (
    <div className="card" style={{ maxWidth: 760 }}>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "#475569", lineHeight: 1.5 }}>
        Colonnes affichées entre le nom du stagiaire et les jours. Une colonne de <strong>créneau</strong> compte le nombre de fois où le stagiaire est
        affecté à ce type de créneau dans le planning.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {columns.map((c, i) => (
          <div
            key={c.id}
            style={{
              display: "grid",
              gridTemplateColumns: "auto 70px minmax(0, 1fr) auto",
              gap: 8,
              alignItems: "center",
              padding: "8px 10px",
              borderRadius: 10,
              background: c.visible ? "#f8fafc" : "#fff",
              border: "1px solid #e2e8f0",
              opacity: c.visible ? 1 : 0.6,
            }}
          >
            <input type="checkbox" checked={c.visible} onChange={(e) => update(i, { visible: e.target.checked })} aria-label={`Afficher ${c.abbr}`} />
            <input value={c.abbr} onChange={(e) => update(i, { abbr: e.target.value.slice(0, 5) })} aria-label="Abréviation" style={{ ...input, fontWeight: 800, textAlign: "center" }} />
            <div style={{ minWidth: 0 }}>
              <input value={c.label} onChange={(e) => update(i, { label: e.target.value.slice(0, 40) })} aria-label="Libellé" style={{ ...input, width: "100%" }} />
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>
                {c.kind === "poste" ? `Créneau du planning : ${posteLabel(c.posteTypeId)}` : INDICATOR_HELP}
              </div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <button type="button" className="btn btn-ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Monter">
                ↑
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => move(i, 1)} disabled={i === columns.length - 1} aria-label="Descendre">
                ↓
              </button>
              {c.kind === "poste" && (
                <button type="button" className="btn btn-ghost" onClick={() => setColumns((cs) => cs.filter((_, j) => j !== i))} aria-label="Supprimer">
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        <select value={newPoste} onChange={(e) => setNewPoste(e.target.value)} style={{ ...input, flex: "1 1 240px", background: "#fff" }}>
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

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-main" onClick={save} disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer les colonnes"}
        </button>
        {message && <span style={{ fontSize: 14, fontWeight: 700, color: message.ok ? "#15803d" : "#dc2626" }}>{message.text}</span>}
      </div>
    </div>
  );
}
