"use client";

import { useEffect, useRef } from "react";

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

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
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
  );
}
