"use client";

import { useEffect, useRef, useState } from "react";
import type { Criterion } from "./PlanningTab";

export type RatingValue = "ACQUIS" | "EN_COURS" | "A_TRAVAILLER" | "NON_OBSERVE";

const STATES: { value: RatingValue; label: string; bg: string; fg: string; border: string }[] = [
  { value: "ACQUIS", label: "🟢 Acquis", bg: "#16a34a", fg: "#fff", border: "#16a34a" },
  { value: "EN_COURS", label: "⚪ En cours", bg: "#f1f5f9", fg: "#334155", border: "#cbd5e1" },
  { value: "A_TRAVAILLER", label: "🟠 À travailler", bg: "#f59e0b", fg: "#fff", border: "#f59e0b" },
  { value: "NON_OBSERVE", label: "○ Non observé", bg: "#fff", fg: "#94a3b8", border: "#cbd5e1" },
];

function stateOf(value: string | undefined) {
  return STATES.find((s) => s.value === value);
}

export default function CriteriaBoard({
  criteria,
  activeDay,
  initialValues,
  canEdit,
  playerId,
}: {
  criteria: Criterion[];
  activeDay: number;
  initialValues: Record<string, string>;
  canEdit: boolean;
  playerId: string;
}) {
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const pendingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/ratings?playerId=${playerId}`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!data?.ok) return;

        const fresh: Record<string, string> = data.values;
        setValues((cur) => {
          let changed = false;
          const next = { ...cur };
          for (const [key, val] of Object.entries(fresh)) {
            if (pendingRef.current.has(key)) continue;
            if (next[key] !== val) {
              next[key] = val;
              changed = true;
            }
          }
          return changed ? next : cur;
        });
      } catch {
        // ignore transient network errors, will retry on next tick
      }
    }, 5000);
    return () => clearInterval(id);
  }, [playerId]);

  async function setValue(criterionId: string, value: RatingValue) {
    const key = `${criterionId}:${activeDay}`;
    setValues((v) => ({ ...v, [key]: value }));
    pendingRef.current.add(key);
    try {
      await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, criterionId, day: activeDay, value }),
      });
    } finally {
      pendingRef.current.delete(key);
    }
  }

  if (criteria.length === 0) {
    return <p style={{ color: "#64748b", fontSize: 14 }}>Aucun critère configuré.</p>;
  }

  return (
    <div className="card">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {criteria.map((c) => {
          const key = `${c.id}:${activeDay}`;
          const current = values[key];
          const currentState = stateOf(current);

          return (
            <div key={c.id}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{c.label}</div>
              {canEdit ? (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {STATES.map((s) => {
                    const active = current === s.value;
                    return (
                      <button
                        key={s.value}
                        onClick={() => setValue(c.id, s.value)}
                        style={{
                          background: active ? s.bg : "#fff",
                          color: active ? s.fg : "#475569",
                          border: `2px solid ${active ? s.border : "#e2e8f0"}`,
                          borderRadius: 10,
                          padding: "5px 10px",
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <span
                  style={{
                    display: "inline-block",
                    background: currentState ? currentState.bg : "#fff",
                    color: currentState ? currentState.fg : "#94a3b8",
                    border: `2px solid ${currentState ? currentState.border : "#e2e8f0"}`,
                    borderRadius: 10,
                    padding: "5px 10px",
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  {currentState ? currentState.label : "Pas encore noté"}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
