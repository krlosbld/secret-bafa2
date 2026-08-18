"use client";

import { useEffect, useRef, useState } from "react";

type Member = { id: string; firstName: string };
type Group = { id: string; name: string; members: Member[]; staff: Member[] };

const POSTIT_COLORS = ["#fde68a", "#fecdd3", "#bbf7d0", "#bfdbfe", "#e9d5ff", "#fed7aa"];
const POSTIT_TILT = [-2, 1.5, -1, 2, -1.5, 1];

export default function GroupGenerator({
  initialGroups,
  stagiaires,
  staffList,
}: {
  initialGroups: Group[];
  stagiaires: Member[];
  staffList: Member[];
}) {
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [error, setError] = useState("");
  const [showRandomPicker, setShowRandomPicker] = useState(false);
  const [randomCount, setRandomCount] = useState(3);
  const [creatingRandom, setCreatingRandom] = useState(false);

  const editingNameRef = useRef<string | null>(null);
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialGroups.map((g) => [g.id, g.name]))
  );

  // Poll en continu pour la synchro entre formateurs — ne touche jamais au nom d'un groupe en cours
  // de renommage localement (évite d'écraser une frappe en cours).
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/groups", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (data?.ok && Array.isArray(data.groups)) {
          setGroups(data.groups);
          setNameDrafts((d) => {
            const next = { ...d };
            for (const g of data.groups as Group[]) {
              if (g.id !== editingNameRef.current) next[g.id] = g.name;
            }
            return next;
          });
        }
      } catch {
        // ignore transient network errors, will retry on next tick
      }
    }, 5000);
    return () => clearInterval(id);
  }, []);

  async function createGroup() {
    setError("");
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Nouveau groupe" }),
    });
    const data = await res.json().catch(() => null);
    if (data?.ok) {
      setGroups((g) => [...g, data.group]);
      setNameDrafts((d) => ({ ...d, [data.group.id]: data.group.name }));
    } else {
      setError(data?.error || "Erreur.");
    }
  }

  async function createRandomGroups() {
    setCreatingRandom(true);
    setError("");
    try {
      const res = await fetch("/api/groups/random", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: randomCount }),
      });
      const data = await res.json().catch(() => null);
      if (data?.ok) {
        setGroups((g) => [...g, ...data.groups]);
        setNameDrafts((d) => {
          const next = { ...d };
          for (const g of data.groups as Group[]) next[g.id] = g.name;
          return next;
        });
        setShowRandomPicker(false);
      } else {
        setError(data?.error || "Erreur.");
      }
    } catch {
      setError("Erreur réseau.");
    } finally {
      setCreatingRandom(false);
    }
  }

  async function renameGroup(groupId: string, name: string) {
    setGroups((g) => g.map((grp) => (grp.id === groupId ? { ...grp, name } : grp)));
    await fetch(`/api/groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  }

  async function deleteGroup(groupId: string) {
    if (!confirm("Supprimer ce groupe ? Cette action est irréversible.")) return;
    setGroups((g) => g.filter((grp) => grp.id !== groupId));
    await fetch(`/api/groups/${groupId}`, { method: "DELETE" });
  }

  async function addMember(groupId: string, playerId: string) {
    const stagiaire = stagiaires.find((s) => s.id === playerId);
    if (!stagiaire) return;
    setGroups((g) =>
      g.map((grp) =>
        grp.id === groupId && !grp.members.some((m) => m.id === playerId)
          ? { ...grp, members: [...grp.members, stagiaire] }
          : grp
      )
    );
    await fetch(`/api/groups/${groupId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId }),
    });
  }

  async function removeMember(groupId: string, playerId: string) {
    setGroups((g) =>
      g.map((grp) => (grp.id === groupId ? { ...grp, members: grp.members.filter((m) => m.id !== playerId) } : grp))
    );
    await fetch(`/api/groups/${groupId}/members/${playerId}`, { method: "DELETE" });
  }

  async function addStaff(groupId: string, playerId: string) {
    if (!playerId) return;
    const person = staffList.find((s) => s.id === playerId);
    if (!person) return;
    setGroups((g) =>
      g.map((grp) =>
        grp.id === groupId && !grp.staff.some((s) => s.id === playerId)
          ? { ...grp, staff: [...grp.staff, person] }
          : grp
      )
    );
    await fetch(`/api/groups/${groupId}/staff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId }),
    });
  }

  async function removeStaff(groupId: string, playerId: string) {
    setGroups((g) =>
      g.map((grp) => (grp.id === groupId ? { ...grp, staff: grp.staff.filter((s) => s.id !== playerId) } : grp))
    );
    await fetch(`/api/groups/${groupId}/staff/${playerId}`, { method: "DELETE" });
  }

  function onDragStart(e: React.DragEvent, playerId: string) {
    e.dataTransfer.setData("text/plain", playerId);
  }

  function allowDrop(e: React.DragEvent) {
    e.preventDefault();
  }

  function onDrop(e: React.DragEvent, groupId: string) {
    e.preventDefault();
    const playerId = e.dataTransfer.getData("text/plain");
    if (playerId) void addMember(groupId, playerId);
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn-ghost" onClick={createGroup}>
            ➕ Ajouter un groupe
          </button>
          <button className="btn btn-ghost" onClick={() => setShowRandomPicker(true)}>
            🎲 Créer des groupes aléatoires
          </button>
        </div>
        <p style={{ fontSize: 12, color: "#94a3b8", margin: "8px 0 0" }}>
          Visible uniquement par les formateurs et directeurs — les stagiaires ne voient jamais leurs groupes. Un
          stagiaire peut appartenir à plusieurs groupes en même temps ; les groupes ne sont jamais supprimés
          automatiquement, seulement à la main.
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

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Tous les stagiaires — glisse vers un groupe pour l&apos;y ajouter
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {stagiaires.map((s) => (
            <div
              key={s.id}
              draggable
              onDragStart={(e) => onDragStart(e, s.id)}
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
              {s.firstName}
            </div>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <p style={{ color: "#64748b" }}>Aucun groupe pour l&apos;instant.</p>
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
              key={group.id}
              onDragOver={allowDrop}
              onDrop={(e) => onDrop(e, group.id)}
              style={{
                background: POSTIT_COLORS[i % POSTIT_COLORS.length],
                borderRadius: 4,
                padding: "14px 16px",
                boxShadow: "0 6px 14px rgba(0,0,0,0.15)",
                transform: `rotate(${POSTIT_TILT[i % POSTIT_TILT.length]}deg)`,
                display: "flex",
                flexDirection: "column",
                minHeight: 180,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <input
                  value={nameDrafts[group.id] ?? group.name}
                  onChange={(e) => setNameDrafts((d) => ({ ...d, [group.id]: e.target.value }))}
                  onFocus={() => {
                    editingNameRef.current = group.id;
                  }}
                  onBlur={(e) => {
                    editingNameRef.current = null;
                    const value = e.target.value.trim() || "Groupe";
                    void renameGroup(group.id, value);
                  }}
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
                  onClick={() => deleteGroup(group.id)}
                  title="Supprimer ce groupe"
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#7c2d12", flexShrink: 0 }}
                >
                  ×
                </button>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {group.members.length === 0 ? (
                  <span style={{ fontSize: 12, color: "#78716c", fontStyle: "italic" }}>Aucun stagiaire.</span>
                ) : (
                  group.members.map((m) => (
                    <span
                      key={m.id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        background: "#fff",
                        border: "1px solid #cbd5e1",
                        borderRadius: 8,
                        padding: "3px 6px 3px 10px",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#1f2937",
                      }}
                    >
                      {m.firstName}
                      <button
                        onClick={() => removeMember(group.id, m.id)}
                        title="Retirer de ce groupe"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 13, padding: 0 }}
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>

              <div style={{ marginTop: "auto", borderTop: "1px dashed rgba(0,0,0,0.2)", paddingTop: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#57534e", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                  Formateurs
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                  {group.staff.map((s) => (
                    <span
                      key={s.id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        background: "#0f172a",
                        borderRadius: 8,
                        padding: "3px 6px 3px 10px",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#fff",
                      }}
                    >
                      {s.firstName}
                      <button
                        onClick={() => removeStaff(group.id, s.id)}
                        title="Retirer de ce groupe"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", fontSize: 13, padding: 0 }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <select
                  value=""
                  onChange={(e) => addStaff(group.id, e.target.value)}
                  style={{ width: "100%", fontSize: 12, padding: "4px 6px", borderRadius: 6, border: "1px solid rgba(0,0,0,0.15)" }}
                >
                  <option value="">+ Ajouter un formateur…</option>
                  {staffList
                    .filter((s) => !group.staff.some((gs) => gs.id === s.id))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.firstName}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {showRandomPicker && (
        <div className="sb-backdrop" onMouseDown={() => setShowRandomPicker(false)}>
          <div className="sb-modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="sb-modal__header">
              <h2>🎲 Groupes aléatoires</h2>
              <button className="sb-x" onClick={() => setShowRandomPicker(false)}>
                ✕
              </button>
            </div>
            <p className="sb-help">
              Crée ce nombre de nouveaux groupes et répartit tous les stagiaires actifs entre eux au hasard. Les
              groupes déjà existants ne sont pas touchés.
            </p>
            <label className="sb-field">
              <span>Nombre de groupes</span>
              <input
                type="number"
                min={1}
                max={30}
                value={randomCount}
                onChange={(e) => setRandomCount(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
              />
            </label>
            <div className="sb-actions">
              <button className="sb-btn sb-btn--ghost" onClick={() => setShowRandomPicker(false)} disabled={creatingRandom}>
                Annuler
              </button>
              <button className="sb-btn sb-btn--main" onClick={createRandomGroups} disabled={creatingRandom}>
                {creatingRandom ? "Création…" : "Créer aléatoirement"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
