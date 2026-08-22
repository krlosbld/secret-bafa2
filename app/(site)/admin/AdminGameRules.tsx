"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GAME_RULES } from "@/lib/gameRules";

export default function AdminGameRules({ initialRules }: { initialRules: Record<string, boolean> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState(initialRules);
  const [loading, setLoading] = useState<string | null>(null);

  async function toggle(key: string) {
    setLoading(key);
    const enabled = !rules[key];
    await fetch("/api/admin/rules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, enabled }),
    });
    setRules((r) => ({ ...r, [key]: enabled }));
    router.refresh();
    setLoading(null);
  }

  return (
    <>
      <button className="btn btn-ghost" onClick={() => setOpen(true)}>
        ⚙️ Changement de règle
      </button>

      {open && (
        <div className="sb-backdrop" onClick={() => setOpen(false)}>
          <div className="sb-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="sb-modal__header">
              <h2>⚙️ Règles du jeu</h2>
              <button className="sb-x" onClick={() => setOpen(false)}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {GAME_RULES.map((r) => (
                <div key={r.key} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{r.label}</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{r.description}</div>
                  </div>
                  <button
                    className={rules[r.key] ? "btn btn-main" : "btn btn-ghost"}
                    disabled={loading === r.key}
                    onClick={() => toggle(r.key)}
                    style={{ flexShrink: 0, whiteSpace: "nowrap" }}
                  >
                    {loading === r.key ? "…" : rules[r.key] ? "Activée ✅" : "Désactivée"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
