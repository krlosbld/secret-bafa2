"use client";

import { useEffect, useState } from "react";

type Assignment = {
  groupCount: number;
  groups: { id: string; firstName: string }[][];
  generatedAt: string;
} | null;

type Stagiaire = { id: string; firstName: string };

export default function GroupGenerator({
  initialAssignment,
  stagiaires,
}: {
  initialAssignment: Assignment;
  stagiaires: Stagiaire[];
}) {
  const [assignment, setAssignment] = useState<Assignment>(initialAssignment);
  const [mode, setMode] = useState<"random" | "manual">("random");

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/groups", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (data?.ok) setAssignment(data.assignment);
      } catch {
        // ignore transient network errors, will retry on next tick
      }
    }, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          className={mode === "random" ? "btn btn-main" : "btn btn-ghost"}
          onClick={() => setMode("random")}
        >
          🎲 Aléatoire
        </button>
        <button
          className={mode === "manual" ? "btn btn-main" : "btn btn-ghost"}
          onClick={() => setMode("manual")}
        >
          ✋ Manuel
        </button>
      </div>

      {mode === "random" ? (
        <RandomGenerator assignment={assignment} setAssignment={setAssignment} />
      ) : (
        <ManualGenerator assignment={assignment} setAssignment={setAssignment} stagiaires={stagiaires} />
      )}

      {!assignment ? (
        <p style={{ color: "#64748b", marginTop: 20 }}>Aucun groupe généré pour l&apos;instant.</p>
      ) : (
        <div style={{ marginTop: 20 }}>
          <PostItGrid groups={assignment.groups} />
        </div>
      )}
    </div>
  );
}

function RandomGenerator({
  assignment,
  setAssignment,
}: {
  assignment: Assignment;
  setAssignment: (a: Assignment) => void;
}) {
  const [groupCount, setGroupCount] = useState(String(assignment?.groupCount ?? 3));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    const n = Number(groupCount);
    if (!Number.isInteger(n) || n < 1) {
      setError("Entre un nombre de groupes valide.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupCount: n }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Erreur.");
        return;
      }
      setAssignment(data.assignment);
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Nombre de groupes</span>
          <input
            type="number"
            min={1}
            value={groupCount}
            onChange={(e) => setGroupCount(e.target.value)}
            style={{ width: 70, border: "1px solid #ddd", borderRadius: 8, padding: "6px 8px", fontSize: 14 }}
          />
        </label>
        <button className="btn btn-main" onClick={generate} disabled={loading}>
          {loading ? "Génération…" : "🎲 Générer"}
        </button>
        {assignment && (
          <span style={{ fontSize: 12, color: "#64748b" }}>
            Dernière génération : {new Date(assignment.generatedAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}
          </span>
        )}
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}
    </div>
  );
}

function ManualGenerator({
  assignment,
  setAssignment,
  stagiaires,
}: {
  assignment: Assignment;
  setAssignment: (a: Assignment) => void;
  stagiaires: Stagiaire[];
}) {
  const [groupCount, setGroupCount] = useState(String(assignment?.groupCount ?? 3));
  const [selection, setSelection] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    assignment?.groups.forEach((group, idx) => {
      group.forEach((p) => {
        initial[p.id] = idx;
      });
    });
    return initial;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const n = Number(groupCount);
  const validCount = Number.isInteger(n) && n >= 1 ? n : 0;
  const unassignedCount = stagiaires.filter((s) => selection[s.id] === undefined).length;

  function toggle(playerId: string, groupIdx: number) {
    setSelection((cur) => {
      const next = { ...cur };
      if (next[playerId] === groupIdx) {
        delete next[playerId];
      } else {
        next[playerId] = groupIdx;
      }
      return next;
    });
  }

  async function save() {
    if (!validCount) {
      setError("Entre un nombre de groupes valide.");
      return;
    }
    setError("");
    setLoading(true);
    const groups: string[][] = Array.from({ length: validCount }, () => []);
    for (const [playerId, idx] of Object.entries(selection)) {
      if (idx < validCount) groups[idx].push(playerId);
    }
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Erreur.");
        return;
      }
      setAssignment(data.assignment);
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Nombre de groupes</span>
          <input
            type="number"
            min={1}
            value={groupCount}
            onChange={(e) => setGroupCount(e.target.value)}
            style={{ width: 70, border: "1px solid #ddd", borderRadius: 8, padding: "6px 8px", fontSize: 14 }}
          />
        </label>
        <button className="btn btn-main" onClick={save} disabled={loading}>
          {loading ? "Enregistrement…" : "✅ Enregistrer les groupes"}
        </button>
        <span style={{ fontSize: 12, color: unassignedCount > 0 ? "#dc2626" : "#64748b" }}>
          {unassignedCount > 0 ? `${unassignedCount} stagiaire(s) non assigné(s)` : "Tout le monde est assigné"}
        </span>
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}

      {stagiaires.length === 0 ? (
        <p style={{ color: "#64748b", fontSize: 14 }}>Aucun stagiaire.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {stagiaires.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, fontWeight: 600, minWidth: 140 }}>{s.firstName}</span>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {Array.from({ length: validCount }, (_, idx) => idx).map((idx) => {
                  const active = selection[s.id] === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => toggle(s.id, idx)}
                      style={{
                        background: active ? "#0f766e" : "#fff",
                        color: active ? "#fff" : "#0f766e",
                        border: "2px solid #0f766e",
                        borderRadius: 8,
                        padding: "3px 9px",
                        fontWeight: 800,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </div>
  );
}

const POSTIT_COLORS = ["#fde68a", "#fecdd3", "#bbf7d0", "#bfdbfe", "#e9d5ff", "#fed7aa"];
const POSTIT_TILT = [-2, 1.5, -1, 2, -1.5, 1];

function PostItGrid({ groups }: { groups: { id: string; firstName: string }[][] }) {
  const columns = Math.max(1, Math.ceil(Math.sqrt(groups.length)));

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 20,
        height: "calc(100vh - 300px)",
        minHeight: 260,
      }}
    >
      {groups.map((group, i) => (
        <div
          key={i}
          style={{
            background: POSTIT_COLORS[i % POSTIT_COLORS.length],
            borderRadius: 4,
            padding: "14px 16px",
            boxShadow: "0 6px 14px rgba(0,0,0,0.15)",
            transform: `rotate(${POSTIT_TILT[i % POSTIT_TILT.length]}deg)`,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8, color: "#1f2937", flexShrink: 0 }}>
            Groupe {i + 1} ({group.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, overflowY: "auto", minHeight: 0 }}>
            {group.map((p) => (
              <div key={p.id} style={{ fontSize: 14, color: "#1f2937" }}>
                {p.firstName}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
