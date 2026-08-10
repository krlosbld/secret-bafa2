"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Formation = {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  _count: { players: number };
};

export default function AdminFormations({ formations }: { formations: Formation[] }) {
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
    if (
      !confirm(
        `Créer la formation "${name.trim()}" et la rendre active ? Les nouvelles inscriptions et connexions basculeront dessus immédiatement ; les données de la formation actuelle restent intactes.`
      )
    ) {
      return;
    }
    setLoading(true);
    const res = await fetch("/api/admin/formations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data?.error || "Erreur.");
      return;
    }
    setName("");
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card">
        <div style={{ fontWeight: 800, marginBottom: 12 }}>Nouvelle formation</div>
        <p style={{ fontSize: 13, color: "#64748b", marginTop: 0, marginBottom: 12 }}>
          Réutilise automatiquement les types de poste, critères et états d&apos;évaluation existants. Les
          stagiaires, le planning, les évaluations et les secrets repartent de zéro pour cette nouvelle formation,
          sans toucher aux données précédentes.
        </p>
        <div className="sb-form">
          <label className="sb-field">
            <span>Nom</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='ex. "BAFA - Session 2"'
              disabled={loading}
            />
          </label>
          {error && <div style={{ color: "#dc2626", fontSize: 14, fontWeight: 600 }}>{error}</div>}
          <button className="btn btn-main" onClick={create} disabled={loading} style={{ alignSelf: "flex-start" }}>
            {loading ? "Création…" : "Créer et activer"}
          </button>
        </div>
      </div>

      {formations.map((f) => (
        <div
          key={f.id}
          className="card"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
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
            <span style={{ color: "#64748b", fontSize: 13, marginLeft: 10 }}>
              Créée le {new Date(f.createdAt).toLocaleDateString("fr-FR")}
            </span>
          </div>
          <div style={{ color: "#64748b", fontSize: 13 }}>{f._count.players} participant(s)</div>
        </div>
      ))}
    </div>
  );
}
