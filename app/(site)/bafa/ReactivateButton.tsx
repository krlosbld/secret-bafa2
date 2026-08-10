"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ReactivateButton({ playerId }: { playerId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function reactivate() {
    setLoading(true);
    await fetch(`/api/players/${playerId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    });
    router.refresh();
  }

  return (
    <button className="btn btn-main" onClick={reactivate} disabled={loading} style={{ padding: "4px 12px", fontSize: 13 }}>
      {loading ? "…" : "↩️ Réactiver"}
    </button>
  );
}
