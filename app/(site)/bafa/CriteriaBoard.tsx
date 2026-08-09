"use client";

import { useEffect, useRef, useState } from "react";
import type { Criterion } from "./PlanningTab";

export type CriterionState = {
  id: string;
  label: string;
  color: string;
  score: number | null;
  order: number;
};

function stateOf(states: CriterionState[], value: string | undefined) {
  return states.find((s) => s.id === value);
}

export default function CriteriaBoard({
  criteria,
  states,
  activeDay,
  initialValues,
  canEdit,
  playerId,
}: {
  criteria: Criterion[];
  states: CriterionState[];
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

  async function setValue(criterionId: string, value: string) {
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
          const currentState = stateOf(states, current);

          return (
            <div key={c.id}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{c.label}</div>
              {canEdit ? (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {states.map((s) => {
                    const active = current === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setValue(c.id, s.id)}
                        style={{
                          background: active ? s.color : "#fff",
                          color: active ? "#fff" : "#475569",
                          border: `2px solid ${active ? s.color : "#e2e8f0"}`,
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
                    background: currentState ? currentState.color : "#fff",
                    color: currentState ? "#fff" : "#94a3b8",
                    border: `2px solid ${currentState ? currentState.color : "#e2e8f0"}`,
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
