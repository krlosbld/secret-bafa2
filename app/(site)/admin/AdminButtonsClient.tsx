"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminButtonsClient({
  id,
  status,
  showName,
  point,
}: {
  id: string;
  status: string;
  showName: boolean;
  point: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function update(data: any) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/secrets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        alert(`Erreur (${res.status})\n${t}`);
        return;
      }

      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!confirm("Supprimer ce secret ?")) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/secrets/${id}`, { method: "DELETE" });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        alert(`Erreur (${res.status})\n${t}`);
        return;
      }

      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-actions">
      {status === "PENDING" ? (
        <button
          className="btn btn-main"
          disabled={loading}
          onClick={() => update({ status: "PUBLISHED" })}
        >
          Publier
        </button>
      ) : (
        <button
          className="btn btn-ghost"
          disabled={loading}
          onClick={() => update({ status: "PENDING" })}
        >
          Remettre en attente
        </button>
      )}

      <button
        className="btn btn-ghost"
        disabled={loading}
        onClick={() => update({ showName: !showName })}
      >
        {showName ? "Cacher le prénom" : "Afficher le prénom"}
      </button>

      <button
        className="btn btn-ghost"
        disabled={loading}
        onClick={() => update({ point: point + 1 })}
      >
        +1 point
      </button>

      <button
        className="btn btn-ghost"
        disabled={loading}
        onClick={() => update({ point: Math.max(0, point - 1) })}
      >
        -1 point
      </button>

      <button className="btn btn-danger" disabled={loading} onClick={remove}>
        Supprimer
      </button>

      {loading && <span style={{ opacity: 0.6 }}>…</span>}
    </div>
  );
}