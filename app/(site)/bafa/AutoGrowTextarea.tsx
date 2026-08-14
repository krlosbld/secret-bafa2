"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

type GrammarMatch = {
  message: string;
  shortMessage: string;
  offset: number;
  length: number;
  replacements: { value: string }[];
  kind: "spelling" | "grammar";
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

  // Segments du texte pour le calque de surlignage placé sous le textarea (fond transparent) : les
  // caractères correspondants s'alignent parfaitement puisque police, taille et paddings sont
  // identiques entre les deux éléments.
  const segments: { text: string; kind: "spelling" | "grammar" | null }[] = [];
  if (matches && matches.length > 0) {
    const sorted = [...matches].sort((a, b) => a.offset - b.offset);
    let cursor = 0;
    for (const m of sorted) {
      if (m.offset < cursor || m.offset + m.length > value.length) continue;
      if (m.offset > cursor) segments.push({ text: value.slice(cursor, m.offset), kind: null });
      segments.push({ text: value.slice(m.offset, m.offset + m.length), kind: m.kind });
      cursor = m.offset + m.length;
    }
    if (cursor < value.length) segments.push({ text: value.slice(cursor), kind: null });
  }

  const sharedBoxStyle: CSSProperties = {
    width: "100%",
    border: "1px solid transparent",
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    minHeight,
  };

  return (
    <div style={{ position: "relative" }}>
      {segments.length > 0 && (
        <div
          aria-hidden
          style={{
            ...sharedBoxStyle,
            position: "absolute",
            inset: 0,
            whiteSpace: "pre-wrap",
            overflowWrap: "break-word",
            color: "transparent",
            pointerEvents: "none",
          }}
        >
          {segments.map((seg, i) =>
            seg.kind === "spelling" ? (
              <span key={i} style={{ textDecoration: "underline wavy #dc2626", textDecorationColor: "#dc2626" }}>
                {seg.text}
              </span>
            ) : seg.kind === "grammar" ? (
              <span key={i} style={{ background: "#dbeafe" }}>
                {seg.text}
              </span>
            ) : (
              <span key={i}>{seg.text}</span>
            )
          )}
        </div>
      )}
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        rows={5}
        style={{
          ...sharedBoxStyle,
          position: "relative",
          border: "1px solid #ddd",
          background: "transparent",
          resize: "none",
          overflow: "hidden",
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
                <span
                  style={
                    m.kind === "spelling"
                      ? { fontWeight: 700, textDecoration: "underline wavy #dc2626" }
                      : { fontWeight: 700, background: "#dbeafe", color: "#1e40af", borderRadius: 3, padding: "0 2px" }
                  }
                >
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
