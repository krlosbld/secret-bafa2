"use client";

import { useEffect, useRef, useState } from "react";
import type { Block, Poste } from "./PlanningTab";
import { POSTE_CATEGORIES } from "@/lib/planningConfig";

function posteOf(postes: Poste[], type: string): Poste | undefined {
  return postes.find((p) => p.id === type);
}

function fmtHours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m}`;
}

const DEFAULT_POSITION = { x: 24, y: 140 };

export default function PlanningHoursTable({
  initialBlocks,
  initialPostes,
  dayCount,
  canEdit,
  initialPosition,
}: {
  initialBlocks: Block[];
  initialPostes: Poste[];
  dayCount: number;
  canEdit: boolean;
  initialPosition: { x: number; y: number } | null;
}) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [postes, setPostes] = useState<Poste[]>(initialPostes);
  const [position, setPosition] = useState(initialPosition ?? DEFAULT_POSITION);
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ dx: 0, dy: 0 });

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const [blocksRes, postesRes, posRes] = await Promise.all([
          fetch("/api/planning", { cache: "no-store" }),
          fetch("/api/planning/postes", { cache: "no-store" }),
          fetch("/api/planning/hours-position", { cache: "no-store" }),
        ]);
        const blocksData = await blocksRes.json().catch(() => null);
        const postesData = await postesRes.json().catch(() => null);
        const posData = await posRes.json().catch(() => null);
        if (blocksData?.ok) setBlocks(blocksData.blocks);
        if (postesData?.ok) setPostes(postesData.postes);
        if (posData?.ok && posData.position && !dragging) setPosition(posData.position);
      } catch {
        // ignore transient network errors, will retry on next tick
      }
    }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleMouseDown(e: React.MouseEvent) {
    if (!canEdit) return;
    dragOffset.current = { dx: e.clientX - position.x, dy: e.clientY - position.y };
    setDragging(true);
  }

  useEffect(() => {
    if (!dragging) return;

    function onMove(e: MouseEvent) {
      setPosition({
        x: Math.max(0, e.clientX - dragOffset.current.dx),
        y: Math.max(0, e.clientY - dragOffset.current.dy),
      });
    }

    function onUp() {
      setDragging(false);
      setPosition((pos) => {
        void fetch("/api/planning/hours-position", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pos),
        });
        return pos;
      });
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  const categoryMinutes: Record<string, number> = {};
  for (const key of Object.keys(POSTE_CATEGORIES)) categoryMinutes[key] = 0;
  for (const b of blocks) {
    if (b.day >= dayCount) continue;
    const category = posteOf(postes, b.type)?.category ?? "AUTRE";
    categoryMinutes[category] = (categoryMinutes[category] ?? 0) + (b.endMin - b.startMin);
  }

  const total = Object.values(categoryMinutes).reduce((s, v) => s + v, 0);

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        zIndex: 500,
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: "12px 16px",
        background: "#fff",
        width: 280,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        cursor: canEdit ? (dragging ? "grabbing" : "grab") : "default",
        userSelect: dragging ? "none" : undefined,
      }}
    >
      {Object.entries(POSTE_CATEGORIES).map(([key, label]) => (
        <div
          key={key}
          style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 14, color: "#334155" }}
        >
          <span>{label}</span>
          <span style={{ fontWeight: 700 }}>{fmtHours(categoryMinutes[key] ?? 0)}</span>
        </div>
      ))}
      <div style={{ borderTop: "1px solid #e5e7eb", margin: "8px 0" }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
        <span>Total</span>
        <span>{fmtHours(total)}</span>
      </div>
    </div>
  );
}
