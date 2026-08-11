"use client";

import { useEffect, useRef, useState } from "react";

type Member = { id: string; firstName: string };
type Group = { name: string; members: Member[] };
type Stagiaire = { id: string; firstName: string };

// Compatible avec l'ancien format stocké ({ groupCount, groups: {id,firstName}[][] })
function normalizeGroups(raw: unknown): Group[] {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { groups?: unknown }).groups)) return [];
  const rawGroups = (raw as { groups: unknown[] }).groups;
  return rawGroups.map((g, idx) => {
    if (Array.isArray(g)) {
      return { name: `Groupe ${idx + 1}`, members: g as Member[] };
    }
    const group = g as { name?: string; members?: Member[] };
    return { name: group.name ?? `Groupe ${idx + 1}`, members: group.members ?? [] };
  });
}

const POSTIT_COLORS = ["#fde68a", "#fecdd3", "#bbf7d0", "#bfdbfe", "#e9d5ff", "#fed7aa"];
const POSTIT_TILT = [-2, 1.5, -1, 2, -1.5, 1];

export default function GroupGenerator({
  initialAssignment,
  stagiaires,
}: {
  initialAssignment: unknown;
  stagiaires: Stagiaire[];
}) {
  const [groups, setGroups] = useState<Group[]>(() => normalizeGroups(initialAssignment));
  const [generatedAt, setGeneratedAt] = useState<string | null>(
    (initialAssignment as { generatedAt?: string } | null)?.generatedAt ?? null
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  // Poll en continu (même pendant l'édition) pour garder la session active — le glisser-déposer
  // et le renommage ne font aucune requête serveur, donc sans ça la session (10 min) expirait
  // pendant qu'on travaille et "Enregistrer" échouait avec "Non autorisé".
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/groups", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (dirtyRef.current) return; // garde la session active sans écraser les modifications en cours
        if (data?.ok && data.assignment) {
          setGroups(normalizeGroups(data.assignment));
          setGeneratedAt(data.assignment.generatedAt);
        }
      } catch {
        // ignore transient network errors, will retry on next tick
      }
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const assignedIds = new Set(groups.flatMap((g) => g.members.map((m) => m.id)));
  const unassigned = stagiaires.filter((s) => !assignedIds.has(s.id));

  function addGroup() {
    setGroups((g) => [...g, { name: `Groupe ${g.length + 1}`, members: [] }]);
    setDirty(true);
  }

  function removeGroup(idx: number) {
    setGroups((g) => g.filter((_, i) => i !== idx));
    setDirty(true);
  }

  function renameGroup(idx: number, name: string) {
    setGroups((g) => g.map((grp, i) => (i === idx ? { ...grp, name } : grp)));
    setDirty(true);
  }

  function moveMember(playerId: string, targetIdx: number | null) {
    const stagiaire = stagiaires.find((s) => s.id === playerId);
    if (!stagiaire) return;
    setGroups((g) =>
      g.map((grp, i) => {
        const without = grp.members.filter((m) => m.id !== playerId);
        if (i === targetIdx) return { ...grp, members: [...without, stagiaire] };
        return { ...grp, members: without };
      })
    );
    setDirty(true);
  }

  function shuffle() {
    if (groups.length === 0) {
      setError("Ajoute au moins un groupe avant de mélanger.");
      return;
    }
    setError("");
    const shuffled = [...stagiaires];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setGroups((g) => {
      const buckets: Member[][] = g.map(() => []);
      shuffled.forEach((s, idx) => buckets[idx % g.length].push(s));
      return g.map((grp, idx) => ({ ...grp, members: buckets[idx] }));
    });
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groups: groups.map((g) => ({ name: g.name, ids: g.members.map((m) => m.id) })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Erreur.");
        return;
      }
      setGroups(normalizeGroups(data.assignment));
      setGeneratedAt(data.assignment.generatedAt);
      setDirty(false);
    } catch {
      setError("Erreur réseau.");
    } finally {
      setSaving(false);
    }
  }

  function onDragStart(e: React.DragEvent, playerId: string) {
    e.dataTransfer.setData("text/plain", playerId);
  }

  function allowDrop(e: React.DragEvent) {
    e.preventDefault();
  }

  function onDrop(e: React.DragEvent, targetIdx: number | null) {
    e.preventDefault();
    const playerId = e.dataTransfer.getData("text/plain");
    if (playerId) moveMember(playerId, targetIdx);
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn-ghost" onClick={addGroup}>
            ➕ Ajouter un groupe
          </button>
          <button className="btn btn-ghost" onClick={shuffle}>
            🎲 Mélanger
          </button>
          <button className="btn btn-main" onClick={save} disabled={saving || !dirty}>
            {saving ? "Enregistrement…" : "✅ Enregistrer"}
          </button>
          <span style={{ fontSize: 12, color: dirty ? "#dc2626" : "#64748b" }}>
            {dirty
              ? "Modifications non enregistrées"
              : generatedAt
              ? `Enregistré : ${new Date(generatedAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}`
              : "Rien d'enregistré pour l'instant"}
          </span>
        </div>
        <p style={{ fontSize: 12, color: "#94a3b8", margin: "8px 0 0" }}>
          Visible uniquement par les formateurs et directeurs — les stagiaires ne voient jamais leur groupe.
        </p>
        {error && (
          <div
            style={{
              marginTop: 10,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 10,
              padding: 10,
              color: "#dc2626",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}
      </div>

      <div
        onDragOver={allowDrop}
        onDrop={(e) => onDrop(e, null)}
        className="card"
        style={{ marginBottom: 20, minHeight: 60 }}
      >
        <div style={{ fontWeight: 800, fontSize: 13, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Non assignés ({unassigned.length})
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {unassigned.length === 0 ? (
            <span style={{ fontSize: 13, color: "#94a3b8" }}>Tout le monde est assigné.</span>
          ) : (
            unassigned.map((s) => (
              <Chip key={s.id} member={s} onDragStart={(e) => onDragStart(e, s.id)} />
            ))
          )}
        </div>
      </div>

      {groups.length === 0 ? (
        <p style={{ color: "#64748b" }}>Aucun groupe pour l&apos;instant — clique "Ajouter un groupe" pour commencer.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${Math.max(1, Math.ceil(Math.sqrt(groups.length)))}, 1fr)`,
            gap: 20,
          }}
        >
          {groups.map((group, i) => (
            <div
              key={i}
              onDragOver={allowDrop}
              onDrop={(e) => onDrop(e, i)}
              style={{
                background: POSTIT_COLORS[i % POSTIT_COLORS.length],
                borderRadius: 4,
                padding: "14px 16px",
                boxShadow: "0 6px 14px rgba(0,0,0,0.15)",
                transform: `rotate(${POSTIT_TILT[i % POSTIT_TILT.length]}deg)`,
                display: "flex",
                flexDirection: "column",
                minHeight: 140,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <input
                  value={group.name}
                  onChange={(e) => renameGroup(i, e.target.value)}
                  style={{
                    flex: 1,
                    background: "rgba(255,255,255,0.6)",
                    border: "1px solid rgba(0,0,0,0.15)",
                    borderRadius: 6,
                    padding: "3px 8px",
                    fontWeight: 800,
                    fontSize: 14,
                    color: "#1f2937",
                    minWidth: 0,
                  }}
                />
                <button
                  onClick={() => removeGroup(i)}
                  title="Supprimer ce groupe"
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#7c2d12", flexShrink: 0 }}
                >
                  ×
                </button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, flex: 1, alignContent: "flex-start" }}>
                {group.members.map((m) => (
                  <Chip key={m.id} member={m} onDragStart={(e) => onDragStart(e, m.id)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ member, onDragStart }: { member: Member; onDragStart: (e: React.DragEvent) => void }) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      style={{
        background: "#fff",
        border: "1px solid #cbd5e1",
        borderRadius: 8,
        padding: "4px 10px",
        fontSize: 13,
        fontWeight: 600,
        color: "#1f2937",
        cursor: "grab",
        userSelect: "none",
      }}
    >
      {member.firstName}
    </div>
  );
}
