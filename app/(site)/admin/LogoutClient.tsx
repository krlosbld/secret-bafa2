"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <button
      onClick={logout}
      disabled={loading}
      style={{
        background: "transparent",
        border: "1px solid #ddd",
        borderRadius: 10,
        padding: "6px 12px",
        cursor: "pointer",
        fontWeight: 700,
        fontSize: "0.85rem",
        color: "#64748b",
      }}
    >
      {loading ? "…" : "Déconnexion"}
    </button>
  );
}
