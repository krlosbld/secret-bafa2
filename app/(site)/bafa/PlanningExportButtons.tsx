"use client";

import { useState, type CSSProperties } from "react";

export default function PlanningExportButtons({ categories }: { categories: Record<string, string> }) {
  const [showPicker, setShowPicker] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(Object.keys(categories)));

  function toggle(key: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const hoursUrl = `/api/planning/pdf-hours?categories=${[...selected].join(",")}`;

  const btnStyle: CSSProperties = {
    background: "#fff",
    color: "#0f172a",
    border: "2px solid #cbd5e1",
    borderRadius: 10,
    padding: "6px 14px",
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-block",
  };

  return (
    <>
      <button type="button" onClick={() => setShowPicker(true)} style={btnStyle}>
        📥 Temps de formation
      </button>
      <a href={`/api/planning/pdf`} style={btnStyle}>
        📥 Planning
      </a>

      {showPicker && (
        <div className="sb-backdrop" onMouseDown={() => setShowPicker(false)}>
          <div className="sb-modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="sb-modal__header">
              <h2>Temps de formation</h2>
              <button className="sb-x" onClick={() => setShowPicker(false)}>
                ✕
              </button>
            </div>
            <p className="sb-help">Choisis les catégories à inclure dans l&apos;export.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {Object.entries(categories).map(([key, label]) => (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                  <input type="checkbox" checked={selected.has(key)} onChange={() => toggle(key)} />
                  {label}
                </label>
              ))}
            </div>
            <div className="sb-actions">
              <button className="sb-btn sb-btn--ghost" onClick={() => setShowPicker(false)}>
                Annuler
              </button>
              <a
                className="sb-btn sb-btn--main"
                href={hoursUrl}
                onClick={() => setShowPicker(false)}
                style={selected.size === 0 ? { pointerEvents: "none", opacity: 0.5 } : undefined}
              >
                Télécharger
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
