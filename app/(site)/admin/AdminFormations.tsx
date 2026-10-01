"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Formation = {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  _count: { players: number };
};

// Liste des formations + création. Une nouvelle formation ne demande que son nom : on arrive
// ensuite sur sa fiche pour régler les détails (type, dates, lieu) et composer l'équipe
// (Équipe → Ajouter un membre). Les stagiaires la rejoignent avec le QR code.
export default function AdminFormations({ formations, canCreate }: { formations: Formation[]; canCreate: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function create() {
    setError("");
    if (!name.trim()) {
      setError("Nom requis.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/admin/formations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      setError(data?.error || "Erreur.");
      return;
    }
    router.push(`/admin/formations/${data.formation.id}`);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {canCreate && (
        <div className="card">
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Nouvelle formation</div>
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 0, marginBottom: 12 }}>
            Indiquez son nom : vous réglerez ensuite le type, les dates et le lieu, puis ajouterez le directeur dans « Équipe ». Les stagiaires
            la rejoindront avec le QR code.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder='ex. "BAFA Base Dijon — octobre"'
              disabled={loading}
              maxLength={120}
              style={{ flex: "1 1 260px", border: "1px solid #ddd", borderRadius: 8, padding: "9px 12px", fontSize: 14 }}
            />
            <button className="btn btn-main" onClick={create} disabled={loading}>
              {loading ? "Création…" : "Créer la formation"}
            </button>
          </div>
          {error && <div style={{ color: "#dc2626", fontSize: 14, fontWeight: 600, marginTop: 8 }}>{error}</div>}
        </div>
      )}

      {formations.map((f) => (
        <Link
          key={f.id}
          href={`/admin/formations/${f.id}`}
          className="card"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", textDecoration: "none", color: "inherit" }}
        >
          <div>
            <span style={{ fontWeight: 800 }}>{f.name}</span>
            {f.active && (
              <span
                style={{
                  marginLeft: 10,
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#16a34a",
                  background: "#dcfce7",
                  padding: "2px 8px",
                  borderRadius: 999,
                }}
              >
                Active
              </span>
            )}
            <span style={{ color: "#64748b", fontSize: 13, marginLeft: 10 }}>Créée le {new Date(f.createdAt).toLocaleDateString("fr-FR")}</span>
          </div>
          <div style={{ color: "#64748b", fontSize: 13 }}>{f._count.players} participant(s) →</div>
        </Link>
      ))}
    </div>
  );
}
