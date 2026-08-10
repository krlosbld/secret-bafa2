"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SESSION_TYPES,
  daysForType,
  dateForDayIndex,
  formatDayHeader,
  POSTE_CATEGORIES,
  DEFAULT_POSTE_CATEGORY,
} from "@/lib/planningConfig";

export type Block = {
  id: string;
  day: number; // 0 = premier jour de la formation, etc.
  startMin: number;
  endMin: number;
  label: string;
  type: string;
};

export type Poste = {
  id: string;
  label: string;
  color: string;
  order: number;
  evaluable: boolean;
  category: string;
};

export type Criterion = {
  id: string;
  label: string;
  order: number;
};

export type CriterionStateDef = {
  id: string;
  label: string;
  color: string;
  score: number | null;
  order: number;
};

const DAY_START = 9 * 60; // 09:00
const DAY_END = 18 * 60 + 30; // 18:30
const PX_PER_MIN = 1.2;
const GRID_HEIGHT = (DAY_END - DAY_START) * PX_PER_MIN;

const FALLBACK_POSTE: Poste = {
  id: "",
  label: "Inconnu",
  color: "#94a3b8",
  order: 999,
  evaluable: false,
  category: DEFAULT_POSTE_CATEGORY,
};

function posteOf(postes: Poste[], type: string): Poste {
  return postes.find((p) => p.id === type) ?? FALLBACK_POSTE;
}

function fmt(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseTime(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  return h * 60 + mi;
}

const snap = (min: number) => Math.round(min / 5) * 5;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

type DragState =
  | { kind: "create"; day: number; anchorMin: number; currentMin: number }
  | { kind: "move"; id: string; day: number; startMin: number; endMin: number; grabOffsetMin: number }
  | { kind: "resize"; id: string; day: number; startMin: number; endMin: number };

function computeLayout(blocks: Block[]): Map<string, { col: number; cols: number }> {
  const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const layout = new Map<string, { col: number; cols: number }>();

  let cluster: Block[] = [];
  let clusterEnd = -Infinity;
  let columnsEnd: number[] = [];

  function flush() {
    if (cluster.length === 0) return;
    const cols = columnsEnd.length;
    for (const b of cluster) {
      const entry = layout.get(b.id);
      if (entry) entry.cols = cols;
    }
    cluster = [];
    columnsEnd = [];
  }

  for (const b of sorted) {
    if (b.startMin >= clusterEnd) {
      flush();
      clusterEnd = -Infinity;
    }
    let placed = false;
    for (let c = 0; c < columnsEnd.length; c++) {
      if (columnsEnd[c] <= b.startMin) {
        columnsEnd[c] = b.endMin;
        layout.set(b.id, { col: c, cols: 1 });
        placed = true;
        break;
      }
    }
    if (!placed) {
      columnsEnd.push(b.endMin);
      layout.set(b.id, { col: columnsEnd.length - 1, cols: 1 });
    }
    cluster.push(b);
    clusterEnd = Math.max(clusterEnd, b.endMin);
  }
  flush();

  return layout;
}

export default function PlanningTab({
  initialBlocks,
  initialPostes,
  initialCriteria,
  initialCriterionStates,
  canEdit,
  sessionType,
  startDate,
}: {
  initialBlocks: Block[];
  initialPostes: Poste[];
  initialCriteria: Criterion[];
  initialCriterionStates: CriterionStateDef[];
  canEdit: boolean;
  sessionType: string;
  startDate: string;
}) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [postes, setPostes] = useState<Poste[]>(initialPostes);
  const [criteria, setCriteria] = useState<Criterion[]>(initialCriteria);
  const [criterionStates, setCriterionStates] = useState<CriterionStateDef[]>(initialCriterionStates);
  const [selectedPoste, setSelectedPoste] = useState<string>(initialPostes[0]?.id ?? "");
  const [eraser, setEraser] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [editing, setEditing] = useState<Block | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const areaRef = useRef<HTMLDivElement | null>(null);

  const dayCount = daysForType(sessionType);
  const dayDates = useMemo(
    () => Array.from({ length: dayCount }, (_, i) => dateForDayIndex(startDate, i)),
    [dayCount, startDate]
  );

  function minAtY(clientY: number) {
    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect) return DAY_START;
    return DAY_START + (clientY - rect.top) / PX_PER_MIN;
  }

  function dayIndexAtX(clientX: number) {
    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const idx = Math.floor(((clientX - rect.left) / rect.width) * dayCount);
    return Math.min(dayCount - 1, Math.max(0, idx));
  }

  async function deleteBlock(id: string) {
    setBlocks((bs) => bs.filter((b) => b.id !== id));
    await fetch(`/api/planning/${id}`, { method: "DELETE" });
  }

  async function duplicateBlock(b: Block) {
    const tmpId = `tmp-${Date.now()}`;
    setBlocks((bs) => [...bs, { ...b, id: tmpId }]);
    const res = await fetch("/api/planning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day: b.day, startMin: b.startMin, endMin: b.endMin, label: b.label, type: b.type }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.block) {
      setBlocks((bs) => bs.map((x) => (x.id === tmpId ? data.block : x)));
    } else {
      setBlocks((bs) => bs.filter((x) => x.id !== tmpId));
    }
  }

  async function finalize(d: DragState) {
    if (d.kind === "create") {
      if (!selectedPoste) return;
      const start = Math.min(d.anchorMin, d.currentMin);
      const end = Math.max(d.anchorMin, d.currentMin);
      if (end - start < 5) return;
      const poste = posteOf(postes, selectedPoste);
      const tmpId = `tmp-${Date.now()}`;
      setBlocks((bs) => [...bs, { id: tmpId, day: d.day, startMin: start, endMin: end, label: poste.label, type: poste.id }]);
      const res = await fetch("/api/planning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day: d.day, startMin: start, endMin: end, label: poste.label, type: poste.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.block) {
        setBlocks((bs) => bs.map((b) => (b.id === tmpId ? data.block : b)));
      } else {
        setBlocks((bs) => bs.filter((b) => b.id !== tmpId));
      }
    } else if (d.kind === "move") {
      setBlocks((bs) => bs.map((b) => (b.id === d.id ? { ...b, day: d.day, startMin: d.startMin, endMin: d.endMin } : b)));
      await fetch(`/api/planning/${d.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day: d.day, startMin: d.startMin, endMin: d.endMin }),
      });
    } else if (d.kind === "resize") {
      setBlocks((bs) => bs.map((b) => (b.id === d.id ? { ...b, endMin: d.endMin } : b)));
      await fetch(`/api/planning/${d.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endMin: d.endMin }),
      });
    }
  }

  useEffect(() => {
    if (!drag) return;
    const activeDrag = drag;

    function onMove(e: MouseEvent) {
      setDrag((cur) => {
        if (!cur) return cur;
        if (cur.kind === "create") {
          return { ...cur, day: dayIndexAtX(e.clientX), currentMin: clamp(snap(minAtY(e.clientY)), DAY_START, DAY_END) };
        }
        if (cur.kind === "move") {
          const duration = cur.endMin - cur.startMin;
          const pointerMin = clamp(minAtY(e.clientY), DAY_START, DAY_END);
          const newStart = clamp(snap(pointerMin - cur.grabOffsetMin), DAY_START, DAY_END - duration);
          return { ...cur, day: dayIndexAtX(e.clientX), startMin: newStart, endMin: newStart + duration };
        }
        if (cur.kind === "resize") {
          const pointerMin = clamp(minAtY(e.clientY), DAY_START, DAY_END);
          const newEnd = clamp(snap(pointerMin), cur.startMin + 5, DAY_END);
          return { ...cur, endMin: newEnd };
        }
        return cur;
      });
    }

    function onUp() {
      void finalize(activeDrag);
      setDrag(null);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag]);

  const effectiveBlocks = useMemo(() => {
    if (!drag || (drag.kind !== "move" && drag.kind !== "resize")) return blocks;
    return blocks.map((b) => (b.id === drag.id ? { ...b, day: drag.day, startMin: drag.startMin, endMin: drag.endMin } : b));
  }, [blocks, drag]);

  const skipPollRef = useRef(false);
  useEffect(() => {
    skipPollRef.current = !!drag || !!editing || showSettings;
  }, [drag, editing, showSettings]);

  useEffect(() => {
    const id = setInterval(async () => {
      if (skipPollRef.current) return;
      try {
        const [blocksRes, postesRes] = await Promise.all([
          fetch("/api/planning", { cache: "no-store" }),
          fetch("/api/planning/postes", { cache: "no-store" }),
        ]);
        const blocksData = await blocksRes.json().catch(() => null);
        const postesData = await postesRes.json().catch(() => null);
        if (blocksData?.ok) setBlocks(blocksData.blocks);
        if (postesData?.ok) setPostes(postesData.postes);
      } catch {
        // ignore transient network errors, will retry on next tick
      }
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const hourMarks: number[] = [];
  for (let m = DAY_START; m <= DAY_END; m += 60) hourMarks.push(m);

  function handleGridMouseDown(e: React.MouseEvent, day: number) {
    if (!canEdit || eraser) return;
    const min = clamp(snap(minAtY(e.clientY)), DAY_START, DAY_END);
    setDrag({ kind: "create", day, anchorMin: min, currentMin: min });
  }

  function handleBlockMouseDown(e: React.MouseEvent, b: Block) {
    e.stopPropagation();
    if (!canEdit) return;
    if (eraser) {
      void deleteBlock(b.id);
      return;
    }
    const pointerMin = clamp(minAtY(e.clientY), DAY_START, DAY_END);
    setDrag({ kind: "move", id: b.id, day: b.day, startMin: b.startMin, endMin: b.endMin, grabOffsetMin: pointerMin - b.startMin });
  }

  function handleResizeMouseDown(e: React.MouseEvent, b: Block) {
    e.stopPropagation();
    if (!canEdit || eraser) return;
    setDrag({ kind: "resize", id: b.id, day: b.day, startMin: b.startMin, endMin: b.endMin });
  }

  async function addPoste(label: string, color: string, evaluable: boolean, category: string) {
    const tmpId = `tmp-${Date.now()}`;
    setPostes((ps) => [...ps, { id: tmpId, label, color, order: ps.length, evaluable, category }]);
    const res = await fetch("/api/planning/postes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, color, evaluable, category }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.poste) {
      setPostes((ps) => ps.map((p) => (p.id === tmpId ? data.poste : p)));
    } else {
      setPostes((ps) => ps.filter((p) => p.id !== tmpId));
    }
  }

  async function updatePoste(id: string, patch: { label?: string; color?: string; evaluable?: boolean; category?: string }) {
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
    if (selectedPoste === id) {
      setSelectedPoste((cur) => (postes.find((p) => p.id !== id)?.id ?? cur));
    }
    return null;
  }

  async function addCriterion(label: string) {
    const tmpId = `tmp-${Date.now()}`;
    setCriteria((cs) => [...cs, { id: tmpId, label, order: cs.length }]);
    const res = await fetch("/api/criteria", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.criterion) {
      setCriteria((cs) => cs.map((c) => (c.id === tmpId ? data.criterion : c)));
    } else {
      setCriteria((cs) => cs.filter((c) => c.id !== tmpId));
    }
  }

  async function renameCriterion(id: string, label: string) {
    setCriteria((cs) => cs.map((c) => (c.id === id ? { ...c, label } : c)));
    await fetch(`/api/criteria/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
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
    <div>
      {canEdit && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {postes.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setSelectedPoste(p.id);
                setEraser(false);
              }}
              style={{
                background: selectedPoste === p.id && !eraser ? p.color : "#fff",
                color: selectedPoste === p.id && !eraser ? "#fff" : p.color,
                border: `2px solid ${p.color}`,
                borderRadius: 10,
                padding: "6px 14px",
                fontWeight: 800,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => setEraser((v) => !v)}
            style={{
              background: eraser ? "#0f172a" : "#fff",
              color: eraser ? "#fff" : "#0f172a",
              border: "2px solid #0f172a",
              borderRadius: 10,
              padding: "6px 14px",
              fontWeight: 800,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            🧽 Gomme
          </button>
          <button
            onClick={() => setShowSettings(true)}
            style={{
              background: "#fff",
              color: "#0f172a",
              border: "2px solid #cbd5e1",
              borderRadius: 10,
              padding: "6px 14px",
              fontWeight: 800,
              fontSize: 13,
              cursor: "pointer",
              marginLeft: "auto",
            }}
          >
            ⚙️ Réglages
          </button>
        </div>
      )}

      <p className="sub" style={{ marginTop: -8, marginBottom: 16, fontSize: 13 }}>
        {SESSION_TYPES[sessionType]?.label ?? sessionType} · {dayCount} jours · du {formatDayHeader(dayDates[0])} au{" "}
        {formatDayHeader(dayDates[dayCount - 1])}
      </p>

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
        <div style={{ display: "flex" }}>
          <div style={{ width: 56, flexShrink: 0, borderBottom: "1px solid #e5e7eb", background: "#f8fafc" }} />
          {dayDates.map((d, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                padding: "10px 8px",
                fontWeight: 800,
                textAlign: "center",
                borderLeft: "1px solid #e5e7eb",
                borderBottom: "1px solid #e5e7eb",
                background: "#f8fafc",
              }}
            >
              {formatDayHeader(d)}
            </div>
          ))}
        </div>

        <div style={{ display: "flex" }}>
          <div style={{ width: 56, flexShrink: 0, position: "relative", height: GRID_HEIGHT }}>
            {hourMarks.map((m) => (
              <div
                key={m}
                style={{
                  position: "absolute",
                  top: (m - DAY_START) * PX_PER_MIN - 7,
                  right: 6,
                  fontSize: 11,
                  color: "#94a3b8",
                }}
              >
                {fmt(m)}
              </div>
            ))}
          </div>

          <div
            ref={areaRef}
            style={{
              flex: 1,
              display: "flex",
              position: "relative",
              height: GRID_HEIGHT,
              backgroundImage: `repeating-linear-gradient(to bottom, #eef2f6 0, #eef2f6 1px, transparent 1px, transparent ${60 * PX_PER_MIN}px)`,
            }}
          >
            {dayDates.map((_, dayIdx) => {
              const dayBlocks = effectiveBlocks.filter((b) => b.day === dayIdx);
              const layout = computeLayout(dayBlocks);

              return (
                <div
                  key={dayIdx}
                  onMouseDown={(e) => handleGridMouseDown(e, dayIdx)}
                  style={{
                    flex: 1,
                    position: "relative",
                    borderLeft: dayIdx === 0 ? "none" : "1px solid #e5e7eb",
                    cursor: canEdit ? (eraser ? "not-allowed" : "crosshair") : "default",
                  }}
                >
                  {dayBlocks.map((b) => {
                    const { col, cols } = layout.get(b.id) ?? { col: 0, cols: 1 };
                    const poste = posteOf(postes, b.type);
                    const top = (b.startMin - DAY_START) * PX_PER_MIN;
                    const height = Math.max((b.endMin - b.startMin) * PX_PER_MIN, 16);
                    const widthPct = 100 / cols;
                    const leftPct = col * widthPct;

                    return (
                      <div
                        key={b.id}
                        onMouseDown={(e) => handleBlockMouseDown(e, b)}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          if (canEdit) setEditing(b);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (canEdit) void duplicateBlock(b);
                        }}
                        title={canEdit ? "Clic droit pour dupliquer" : undefined}
                        style={{
                          position: "absolute",
                          top,
                          height,
                          left: `calc(${leftPct}% + 2px)`,
                          width: `calc(${widthPct}% - 4px)`,
                          background: poste.color,
                          color: "#fff",
                          borderRadius: 6,
                          padding: "3px 6px",
                          fontSize: 11,
                          fontWeight: 700,
                          overflow: "hidden",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                          cursor: canEdit ? (eraser ? "not-allowed" : "grab") : "default",
                          userSelect: "none",
                          zIndex: 2,
                        }}
                      >
                        {canEdit && (
                          <button
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              void deleteBlock(b.id);
                            }}
                            style={{
                              position: "absolute",
                              top: 2,
                              right: 2,
                              background: "transparent",
                              border: "none",
                              color: "#fff",
                              cursor: "pointer",
                              fontSize: 11,
                              lineHeight: 1,
                              padding: 2,
                            }}
                          >
                            ✕
                          </button>
                        )}
                        <div style={{ paddingRight: canEdit ? 14 : 0 }}>{b.label}</div>
                        <div style={{ opacity: 0.85, fontSize: 10 }}>
                          {fmt(b.startMin)}–{fmt(b.endMin)}
                        </div>
                        {canEdit && (
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              handleResizeMouseDown(e, b);
                            }}
                            style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 6, cursor: "ns-resize" }}
                          />
                        )}
                      </div>
                    );
                  })}

                  {drag && drag.kind === "create" && drag.day === dayIdx && (
                    <div
                      style={{
                        position: "absolute",
                        top: (Math.min(drag.anchorMin, drag.currentMin) - DAY_START) * PX_PER_MIN,
                        height: Math.max((Math.abs(drag.currentMin - drag.anchorMin)) * PX_PER_MIN, 4),
                        left: 2,
                        right: 2,
                        background: posteOf(postes, selectedPoste).color,
                        opacity: 0.5,
                        borderRadius: 6,
                        pointerEvents: "none",
                        zIndex: 3,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {editing && (
        <div className="sb-backdrop" onMouseDown={() => setEditing(null)}>
          <div className="sb-modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="sb-modal__header">
              <h2>Modifier le créneau</h2>
              <button className="sb-x" onClick={() => setEditing(null)}>✕</button>
            </div>
            <EditBlockForm
              block={editing}
              postes={postes}
              onCancel={() => setEditing(null)}
              onSave={async (patch) => {
                const id = editing.id;
                setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
                setEditing(null);
                await fetch(`/api/planning/${id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(patch),
                });
              }}
              onDelete={async () => {
                const id = editing.id;
                setEditing(null);
                await deleteBlock(id);
              }}
            />
          </div>
        </div>
      )}

      {showSettings && (
        <div className="sb-backdrop" onMouseDown={() => setShowSettings(false)}>
          <div className="sb-modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 420, maxHeight: "85vh", overflowY: "auto" }}>
            <div className="sb-modal__header">
              <h2>Réglages du planning</h2>
              <button className="sb-x" onClick={() => setShowSettings(false)}>✕</button>
            </div>
            <SettingsForm
              sessionType={sessionType}
              startDate={startDate}
              onCancel={() => setShowSettings(false)}
              onSave={async (patch) => {
                setShowSettings(false);
                await fetch("/api/planning/config", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(patch),
                });
                router.refresh();
              }}
            />

            <div style={{ borderTop: "1px solid #eee", marginTop: 20, paddingTop: 16 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Types de créneaux</div>
              <PosteManager postes={postes} onAdd={addPoste} onUpdate={updatePoste} onRemove={removePoste} />
            </div>

            <div style={{ borderTop: "1px solid #eee", marginTop: 20, paddingTop: 16 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Critères d'évaluation quotidiens</div>
              <CriteriaManager criteria={criteria} onAdd={addCriterion} onRename={renameCriterion} onRemove={removeCriterion} />
            </div>

            <div style={{ borderTop: "1px solid #eee", marginTop: 20, paddingTop: 16 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>États de notation des critères</div>
              <CriterionStateManager
                states={criterionStates}
                onAdd={addCriterionState}
                onUpdate={updateCriterionState}
                onRemove={removeCriterionState}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsForm({
  sessionType,
  startDate,
  onSave,
  onCancel,
}: {
  sessionType: string;
  startDate: string;
  onSave: (patch: { sessionType: string; startDate: string }) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState(sessionType);
  const [date, setDate] = useState(startDate);

  return (
    <div className="sb-form">
      <label className="sb-field">
        <span>Type de formation</span>
        <select value={type} onChange={(e) => setType(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}>
          {Object.entries(SESSION_TYPES).map(([key, v]) => (
            <option key={key} value={key}>
              {v.label} — {v.days} jours
            </option>
          ))}
        </select>
      </label>

      <label className="sb-field">
        <span>Date de début</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>

      <div className="sb-actions">
        <button className="sb-btn sb-btn--ghost" onClick={onCancel}>
          Annuler
        </button>
        <button className="sb-btn sb-btn--main" onClick={() => onSave({ sessionType: type, startDate: date })}>
          Enregistrer
        </button>
      </div>
    </div>
  );
}

function EditBlockForm({
  block,
  postes,
  onSave,
  onCancel,
  onDelete,
}: {
  block: Block;
  postes: Poste[];
  onSave: (patch: { label: string; type: string; startMin: number; endMin: number }) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(block.label);
  const [type, setType] = useState(block.type);
  const [start, setStart] = useState(fmt(block.startMin));
  const [end, setEnd] = useState(fmt(block.endMin));
  const [error, setError] = useState<string | null>(null);

  function save() {
    const startMin = parseTime(start);
    const endMin = parseTime(end);
    if (startMin === null || endMin === null) {
      setError("Format d'heure invalide (HH:MM).");
      return;
    }
    if (endMin - startMin < 5) {
      setError("La fin doit être au moins 5 minutes après le début.");
      return;
    }
    if (startMin < DAY_START || endMin > DAY_END) {
      setError(`Le créneau doit rester entre ${fmt(DAY_START)} et ${fmt(DAY_END)}.`);
      return;
    }
    onSave({ label: label.trim() || "Sans titre", type, startMin: snap(startMin), endMin: snap(endMin) });
  }

  return (
    <div className="sb-form">
      <label className="sb-field">
        <span>Titre</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} />
      </label>

      <label className="sb-field">
        <span>Type</span>
        <select value={type} onChange={(e) => setType(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}>
          {postes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <div style={{ display: "flex", gap: 10 }}>
        <label className="sb-field" style={{ flex: 1 }}>
          <span>Début</span>
          <input value={start} onChange={(e) => setStart(e.target.value)} placeholder="07:30" />
        </label>
        <label className="sb-field" style={{ flex: 1 }}>
          <span>Fin</span>
          <input value={end} onChange={(e) => setEnd(e.target.value)} placeholder="17:00" />
        </label>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: 10, color: "#dc2626", fontWeight: 600, fontSize: 14 }}>
          {error}
        </div>
      )}

      {postes.find((p) => p.id === type)?.evaluable && <BlockAssignmentEditor blockId={block.id} />}

      <div className="sb-actions" style={{ justifyContent: "space-between" }}>
        <button className="sb-btn sb-btn--ghost" onClick={onDelete} style={{ color: "#dc2626" }}>
          Supprimer
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="sb-btn sb-btn--ghost" onClick={onCancel}>
            Annuler
          </button>
          <button className="sb-btn sb-btn--main" onClick={save}>
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

function PosteManager({
  postes,
  onAdd,
  onUpdate,
  onRemove,
}: {
  postes: Poste[];
  onAdd: (label: string, color: string, evaluable: boolean, category: string) => Promise<void>;
  onUpdate: (id: string, patch: { label?: string; color?: string; evaluable?: boolean; category?: string }) => Promise<void>;
  onRemove: (id: string) => Promise<string | null>;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#0f766e");
  const [newEvaluable, setNewEvaluable] = useState(false);
  const [newCategory, setNewCategory] = useState(DEFAULT_POSTE_CATEGORY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function handleAdd() {
    if (!newLabel.trim()) return;
    setBusy("new");
    await onAdd(newLabel.trim(), newColor, newEvaluable, newCategory);
    setNewLabel("");
    setNewEvaluable(false);
    setNewCategory(DEFAULT_POSTE_CATEGORY);
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
        Coche "Évaluable" pour qu'une case d'évaluation par stagiaire apparaisse automatiquement sur chaque créneau de ce type.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {postes.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="color"
              value={p.color}
              onChange={(e) => onUpdate(p.id, { color: e.target.value })}
              style={{ width: 32, height: 32, padding: 0, border: "none", borderRadius: 6, cursor: "pointer" }}
            />
            <input
              value={p.label}
              onChange={(e) => onUpdate(p.id, { label: e.target.value })}
              style={{ flex: 1, border: "1px solid #ddd", borderRadius: 8, padding: "6px 8px", fontSize: 14 }}
            />
            <select
              value={p.category}
              onChange={(e) => onUpdate(p.id, { category: e.target.value })}
              style={{ border: "1px solid #ddd", borderRadius: 6, padding: "5px 6px", fontSize: 12 }}
            >
              {Object.entries(POSTE_CATEGORIES).map(([value, label]) => (
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
          style={{ width: 32, height: 32, padding: 0, border: "none", borderRadius: 6, cursor: "pointer" }}
        />
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Nouveau type…"
          style={{ flex: 1, border: "1px solid #ddd", borderRadius: 8, padding: "6px 8px", fontSize: 14 }}
        />
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          style={{ border: "1px solid #ddd", borderRadius: 6, padding: "5px 6px", fontSize: 12 }}
        >
          {Object.entries(POSTE_CATEGORIES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#475569", whiteSpace: "nowrap" }}>
          <input type="checkbox" checked={newEvaluable} onChange={(e) => setNewEvaluable(e.target.checked)} />
          Évaluable
        </label>
        <button className="btn btn-main" onClick={handleAdd} disabled={busy === "new" || !newLabel.trim()} style={{ padding: "6px 12px" }}>
          + Ajouter
        </button>
      </div>
    </div>
  );
}

function CriteriaManager({
  criteria,
  onAdd,
  onRename,
  onRemove,
}: {
  criteria: Criterion[];
  onAdd: (label: string) => Promise<void>;
  onRename: (id: string, label: string) => Promise<void>;
  onRemove: (id: string) => Promise<string | null>;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function handleAdd() {
    if (!newLabel.trim()) return;
    setBusy("new");
    await onAdd(newLabel.trim());
    setNewLabel("");
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
        Ces critères apparaissent chaque jour sur la page de chaque stagiaire (Acquis / En cours / À travailler / Non observé).
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {criteria.map((c) => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              value={c.label}
              onChange={(e) => onRename(c.id, e.target.value)}
              style={{ flex: 1, border: "1px solid #ddd", borderRadius: 8, padding: "6px 8px", fontSize: 14 }}
            />
            <button
              onClick={() => handleRemove(c.id)}
              disabled={busy === c.id}
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

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Nouveau critère…"
          style={{ flex: 1, border: "1px solid #ddd", borderRadius: 8, padding: "6px 8px", fontSize: 14 }}
        />
        <button className="btn btn-main" onClick={handleAdd} disabled={busy === "new" || !newLabel.trim()} style={{ padding: "6px 12px" }}>
          + Ajouter
        </button>
      </div>
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
        Le score (-1 à 2, n'importe quelle valeur décimale) détermine le sens et la couleur de la flèche de tendance
        quotidienne. Coche "Exclure" pour un état comme "Non observé" qui ne doit pas compter dans le calcul.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {states.map((s) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="color"
              value={s.color}
              onChange={(e) => onUpdate(s.id, { color: e.target.value })}
              style={{ width: 32, height: 32, padding: 0, border: "none", borderRadius: 6, cursor: "pointer" }}
            />
            <input
              value={s.label}
              onChange={(e) => onUpdate(s.id, { label: e.target.value })}
              style={{ flex: 1, border: "1px solid #ddd", borderRadius: 8, padding: "6px 8px", fontSize: 14 }}
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
          style={{ width: 32, height: 32, padding: 0, border: "none", borderRadius: 6, cursor: "pointer" }}
        />
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Nouvel état…"
          style={{ flex: 1, border: "1px solid #ddd", borderRadius: 8, padding: "6px 8px", fontSize: 14 }}
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

type AssignmentData = {
  stagiaires: { id: string; firstName: string }[];
  assignedIds: string[];
  evaluatedIds: string[];
};

function BlockAssignmentEditor({ blockId }: { blockId: string }) {
  const [data, setData] = useState<AssignmentData | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/planning/${blockId}/assignments`);
      const json = await res.json().catch(() => null);
      if (cancelled || !json?.ok) return;
      setData(json);
      setSelected(new Set(json.assignedIds));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [blockId]);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    await fetch(`/api/planning/${blockId}/assignments`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerIds: [...selected] }),
    });
    setSaving(false);
    setSaved(true);
  }

  return (
    <div style={{ borderTop: "1px solid #eee", paddingTop: 12, marginTop: 4 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Stagiaires concernés</div>
      <p style={{ fontSize: 12, color: "#64748b", marginTop: 0, marginBottom: 8 }}>
        Laisse tout décoché pour que ce créneau s'applique à tout le monde. Coche uniquement les stagiaires
        réellement concernés ce jour-là (ex : accueil échelonné, projet d'animation…).
      </p>

      {loading || !data ? (
        <p style={{ fontSize: 13, color: "#94a3b8" }}>Chargement…</p>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 180, overflowY: "auto", marginBottom: 8 }}>
            {data.stagiaires.map((s) => {
              const isSelected = selected.has(s.id);
              const notEvaluated = isSelected && !data.evaluatedIds.includes(s.id);
              return (
                <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                  <input type="checkbox" checked={isSelected} onChange={() => toggle(s.id)} />
                  <span className={notEvaluated ? "blink-red" : undefined}>{s.firstName}</span>
                  {notEvaluated && <span style={{ fontSize: 11, color: "#dc2626" }}>(non évalué)</span>}
                </label>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {saved && <span style={{ color: "#16a34a", fontSize: 12, fontWeight: 700 }}>Enregistré ✓</span>}
            <button className="btn btn-ghost" style={{ padding: "4px 12px", fontSize: 13 }} onClick={save} disabled={saving}>
              {saving ? "…" : "Enregistrer les concernés"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
