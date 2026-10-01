"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// « Revenir à mon compte » + compte à rebours. À l'échéance (1 h), ou si la session « en tant que »
// a déjà expiré (expiresAt = null), le retour vers l'administration se fait tout seul.
export default function StopImpersonationButton({ expiresAt }: { expiresAt: string | null }) {
  const [loading, setLoading] = useState(false);
  const [remainingMs, setRemainingMs] = useState<number | null>(null); // calculé au premier tic
  const stopping = useRef(false);

  const stop = useCallback(async () => {
    if (stopping.current) return;
    stopping.current = true;
    setLoading(true);
    const res = await fetch("/api/auth/stop-impersonation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    window.location.assign(res?.ok && typeof data.next === "string" ? data.next : "/admin/utilisateurs");
  }, []);

  useEffect(() => {
    if (!expiresAt) {
      const t = setTimeout(stop, 0);
      return () => clearTimeout(t);
    }
    const end = new Date(expiresAt).getTime();
    const tick = () => {
      const left = end - Date.now();
      setRemainingMs(left);
      if (left <= 0) stop();
    };
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [expiresAt, stop]);

  const minutes = remainingMs !== null && remainingMs > 0 ? Math.ceil(remainingMs / 60000) : 0;

  return (
    <>
      {expiresAt && remainingMs !== null && remainingMs > 0 && (
        <span style={{ fontWeight: 600, opacity: 0.9 }}>
          Retour automatique dans {minutes} min
        </span>
      )}
      <button
        type="button"
        onClick={stop}
        disabled={loading}
        style={{ background: "#fff", color: "#b45309", border: "none", borderRadius: 8, padding: "5px 12px", fontWeight: 800, cursor: "pointer", fontSize: 13 }}
      >
        {loading ? "Retour…" : "Revenir à mon compte"}
      </button>
    </>
  );
}
