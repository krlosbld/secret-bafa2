"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GAME_RULES, paramConfigKey, type GameRule } from "@/lib/gameRules";

const SECTIONS: { key: GameRule["section"]; title: string }[] = [
  { key: "classique", title: "Règles classiques" },
  { key: "pouvoirs", title: "Pouvoirs et événements stratégiques" },
];

export default function AdminGameRules({
  initialRules,
  initialParams = {},
}: {
  initialRules: Record<string, boolean>;
  initialParams?: Record<string, number>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState(initialRules);
  const [params, setParams] = useState(initialParams);
  const [loading, setLoading] = useState<string | null>(null);
  const [paramError, setParamError] = useState<string | null>(null);

  async function saveParam(ruleKey: string, paramKey: string, value: number) {
    const k = paramConfigKey(ruleKey, paramKey);
    setParamError(null);
    setLoading(k);
    const res = await fetch("/api/admin/rules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: ruleKey, param: paramKey, value }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setParams((p) => ({ ...p, [k]: value }));
    else setParamError(data.error || "Valeur refusée.");
    setLoading(null);
  }

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
          <div className="sb-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, maxHeight: "85vh", overflowY: "auto" }}>
            <div className="sb-modal__header">
              <h2>⚙️ Règles du jeu</h2>
              <button className="sb-x" onClick={() => setOpen(false)}>✕</button>
            </div>
            {paramError && <p style={{ color: "#dc2626", fontWeight: 600, fontSize: 13, margin: "0 0 10px" }}>{paramError}</p>}
            {SECTIONS.filter((sec) => GAME_RULES.some((r) => r.section === sec.key)).map((sec) => (
              <div key={sec.key} style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
                  {sec.title}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {GAME_RULES.filter((r) => r.section === sec.key).map((r) => (
                    <div key={r.key} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{r.label}</div>
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{r.description}</div>
                        {r.incompatibleWith && r.incompatibleWith.length > 0 && (
                          <div style={{ fontSize: 12, color: "#9a3412", marginTop: 2 }}>
                            Incompatible avec : {r.incompatibleWith.map((k) => GAME_RULES.find((x) => x.key === k)?.label ?? k).join(", ")} (pour un
                            même joueur, en même temps)
                          </div>
                        )}
                        {(r.params ?? []).map((p) => {
                          const k = paramConfigKey(r.key, p.key);
                          return (
                            <label key={p.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginTop: 6 }}>
                              {p.label}
                              <input
                                type="number"
                                min={p.min}
                                max={p.max}
                                defaultValue={params[k] ?? p.default}
                                disabled={loading === k}
                                onBlur={(e) => {
                                  const v = Number(e.target.value);
                                  if (v !== (params[k] ?? p.default)) void saveParam(r.key, p.key, v);
                                }}
                                style={{ width: 64, border: "1px solid #ddd", borderRadius: 6, padding: "3px 6px" }}
                              />
                              {p.unit}
                              <span style={{ color: "#94a3b8" }}>
                                ({p.min} à {p.max})
                              </span>
                            </label>
                          );
                        })}
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
            ))}
          </div>
        </div>
      )}
    </>
  );
}
