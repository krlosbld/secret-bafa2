"use client";

import { useState } from "react";

type HistoryEntry = { id: string; previousValue: string; newValue: string; author: string | null; createdAt: string };

export default function TextHistoryButton({
  entityType,
  entityKey,
  onRestore,
}: {
  entityType: string;
  entityKey: string;
  onRestore: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);

  async function openHistory() {
    setOpen(true);
    setLoading(true);
    const res = await fetch(`/api/text-history?entityType=${entityType}&entityKey=${encodeURIComponent(entityKey)}`);
    const data = await res.json().catch(() => null);
    setEntries(data?.ok ? data.history : []);
    setLoading(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={openHistory}
        title="Historique de cette case"
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#94a3b8", padding: 0 }}
      >
        🕘
      </button>
      {open && (
        <div className="sb-backdrop" onMouseDown={() => setOpen(false)}>
          <div className="sb-modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 480, maxHeight: "80vh", overflowY: "auto" }}>
            <div className="sb-modal__header">
              <h2>Historique</h2>
              <button className="sb-x" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>
            {loading ? (
              <p className="sb-help">Chargement…</p>
            ) : !entries || entries.length === 0 ? (
              <p className="sb-help">Aucun historique pour cette case.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {entries.map((e) => (
                  <div key={e.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10 }}>
                    <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
                      {new Date(e.createdAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}
                      {e.author && <> · {e.author}</>}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Avant cette modification
                    </div>
                    <p
                      style={{
                        fontSize: 13,
                        whiteSpace: "pre-wrap",
                        color: e.previousValue ? "#0f172a" : "#94a3b8",
                        marginTop: 0,
                        marginBottom: 8,
                        fontStyle: e.previousValue ? "normal" : "italic",
                      }}
                    >
                      {e.previousValue || "Vide"}
                    </p>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: "4px 10px", fontSize: 12 }}
                      onClick={() => {
                        onRestore(e.previousValue);
                        setOpen(false);
                      }}
                    >
                      ↩ Restaurer cette version
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
