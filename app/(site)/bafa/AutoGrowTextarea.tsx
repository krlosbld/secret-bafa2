"use client";

import { useEffect, useRef, useState } from "react";

type GrammarMatch = {
  message: string;
  shortMessage: string;
  offset: number;
  length: number;
  replacements: { value: string }[];
};

export default function AutoGrowTextarea({
  value,
  onChange,
  minHeight = 110,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  minHeight?: number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [checking, setChecking] = useState(false);
  const [matches, setMatches] = useState<GrammarMatch[] | null>(null);
  const [checkError, setCheckError] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  // Le timer en attente ne doit pas survivre au démontage (changement de stagiaire, fermeture de
  // panneau, etc.), sinon il déclencherait un appel réseau et un setState sur un composant disparu.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleChange(v: string) {
    setMatches(null);
    setCheckError(false);
    onChange(v);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (v.trim()) void runCheck(v);
    }, 1800);
  }

  async function runCheck(text: string) {
    setChecking(true);
    setCheckError(false);
    try {
      const res = await fetch("/api/grammar-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setCheckError(true);
        setMatches(null);
      } else {
        setMatches(data.matches);
      }
    } catch {
      setCheckError(true);
      setMatches(null);
    } finally {
      setChecking(false);
    }
  }

  function applyReplacement(m: GrammarMatch, replacement: string) {
    const next = value.slice(0, m.offset) + replacement + value.slice(m.offset + m.length);
    setMatches(null);
    onChange(next);
  }

  return (
    <div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        rows={5}
        style={{
          width: "100%",
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 8,
          fontSize: 14,
          resize: "none",
          overflow: "hidden",
          minHeight,
        }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ padding: "4px 12px", fontSize: 12 }}
          disabled={checking || !value.trim()}
          onClick={() => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            void runCheck(value);
          }}
        >
          {checking ? "Vérification…" : "✓ Vérifier maintenant"}
        </button>
        {checkError && <span style={{ fontSize: 12, color: "#dc2626" }}>Correcteur indisponible, réessaie.</span>}
        {matches && matches.length === 0 && (
          <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 700 }}>Aucune erreur détectée ✓</span>
        )}
        {matches && matches.length > 0 && (
          <span style={{ fontSize: 12, color: "#b45309", fontWeight: 700 }}>
            {matches.length} suggestion{matches.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {matches && matches.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {matches.map((m, i) => (
            <div
              key={i}
              style={{
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: 8,
                padding: 8,
                fontSize: 13,
              }}
            >
              <div style={{ marginBottom: m.replacements.length > 0 ? 6 : 0 }}>
                <span style={{ fontWeight: 700, textDecoration: "underline wavy #dc2626" }}>
                  {value.slice(m.offset, m.offset + m.length)}
                </span>
                <span style={{ color: "#78716c" }}> — {m.shortMessage || m.message}</span>
              </div>
              {m.replacements.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {m.replacements.map((r, j) => (
                    <button
                      key={j}
                      type="button"
                      onClick={() => applyReplacement(m, r.value)}
                      style={{
                        background: "#fff",
                        border: "1px solid #d6d3d1",
                        borderRadius: 999,
                        padding: "2px 10px",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#0f172a",
                        cursor: "pointer",
                      }}
                    >
                      {r.value}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
