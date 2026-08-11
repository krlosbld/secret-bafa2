"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const GRACE_DAYS = 7;

export default function AdminFormationDates({
  formationId,
  startDate,
  endDate,
}: {
  formationId: string;
  startDate: string;
  endDate: string;
}) {
  const router = useRouter();
  const [start, setStart] = useState(startDate);
  const [end, setEnd] = useState(endDate);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setLoading(true);
    setSaved(false);
    await fetch(`/api/admin/formations/${formationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: start || null, endDate: end || null }),
    });
    setLoading(false);
    setSaved(true);
    router.refresh();
  }

  const autoDeactivateDate = end
    ? new Date(new Date(end).getTime() + GRACE_DAYS * 86400000).toLocaleDateString("fr-FR")
    : null;

  return (
    <div className="card">
      <div className="sb-form" style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end" }}>
        <label className="sb-field">
          <span>Début</span>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} disabled={loading} />
        </label>
        <label className="sb-field">
          <span>Fin</span>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} disabled={loading} />
        </label>
        <button className="btn btn-ghost" onClick={save} disabled={loading}>
          {loading ? "…" : "Enregistrer"}
        </button>
        {saved && <span style={{ color: "#16a34a", fontSize: 13, fontWeight: 700 }}>Enregistré ✓</span>}
      </div>
      {autoDeactivateDate && (
        <p style={{ fontSize: 12, color: "#64748b", margin: "10px 0 0" }}>
          Désactivation automatique le {autoDeactivateDate} si non renouvelée ({GRACE_DAYS} j après la fin).
        </p>
      )}
    </div>
  );
}
