"use client";

import { useState } from "react";

export default function StopImpersonationButton() {
  const [loading, setLoading] = useState(false);

  async function stop() {
    setLoading(true);
    const res = await fetch("/api/auth/stop-impersonation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const data = await res.json().catch(() => ({}));
    window.location.assign(res.ok && typeof data.next === "string" ? data.next : "/admin/utilisateurs");
  }

  return (
    <button
      type="button"
      onClick={stop}
      disabled={loading}
      style={{ background: "#fff", color: "#b45309", border: "none", borderRadius: 8, padding: "5px 12px", fontWeight: 800, cursor: "pointer", fontSize: 13 }}
    >
      {loading ? "Retour…" : "Revenir à mon compte"}
    </button>
  );
}
