"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Formation = {
  id: string;
  name: string;
  code: string;
  active: boolean;
  createdAt: string;
  _count: { players: number };
};

export default function AdminFormations({ formations, canCreate }: { formations: Formation[]; canCreate: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [directorFirstName, setDirectorFirstName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ code: string; director: { firstName: string; code: string } | null } | null>(null);

  async function create() {
    setError("");
    setCreated(null);
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
      body: JSON.stringify({ name, directorFirstName: directorFirstName.trim() || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data?.error || "Erreur.");
      return;
    }
    setName("");
    setDirectorFirstName("");
    setCreated({ code: data.formation.code, director: data.director ?? null });
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {canCreate && (
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
            <label className="sb-field">
              <span>Prénom du directeur (optionnel)</span>
              <input
                value={directorFirstName}
                onChange={(e) => setDirectorFirstName(e.target.value)}
                placeholder="ex. Marie"
                disabled={loading}
              />
            </label>
            {error && <div style={{ color: "#dc2626", fontSize: 14, fontWeight: 600 }}>{error}</div>}
            <button className="btn btn-main" onClick={create} disabled={loading} style={{ alignSelf: "flex-start" }}>
              {loading ? "Création…" : "Créer et activer"}
            </button>
          </div>
        </div>
      )}

      {created && (
        <div className="card" style={{ borderLeftColor: "#16a34a", background: "#f0fdf4" }}>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>Formation créée ✅</div>
          <p style={{ margin: "0 0 6px", fontSize: 14 }}>
            Code de session : <span style={{ fontWeight: 900, fontSize: 18, color: "#16a34a" }}>{created.code}</span>
            {" "}— à donner à tous les participants, ils l&apos;entrent en arrivant sur le site.
          </p>
          {created.director && (
            <p style={{ margin: 0, fontSize: 14 }}>
              {created.director.firstName} (directeur) se connecte ensuite avec son code personnel{" "}
              <span style={{ fontWeight: 900, fontSize: 18, color: "#16a34a" }}>{created.director.code}</span>
              {" "}— ces codes ne seront pas réaffichés.
            </p>
          )}
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
            <span style={{ color: "#64748b", fontSize: 13, marginLeft: 10 }}>
              Créée le {new Date(f.createdAt).toLocaleDateString("fr-FR")} · code {f.code}
            </span>
          </div>
          <div style={{ color: "#64748b", fontSize: 13 }}>{f._count.players} participant(s) →</div>
        </Link>
      ))}
    </div>
  );
}
