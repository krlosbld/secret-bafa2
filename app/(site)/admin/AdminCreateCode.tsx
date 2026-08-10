"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const ROLE_LABELS: Record<string, string> = {
  DIRECTEUR: "Directeur",
  FORMATEUR: "Formateur",
  STAGIAIRE: "Stagiaire",
};

export default function AdminCreateCode({ formationId }: { formationId: string }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [role, setRole] = useState("DIRECTEUR");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ firstName: string; code: string; role: string } | null>(null);

  async function create() {
    setError("");
    setCreated(null);
    if (!firstName.trim()) {
      setError("Prénom requis.");
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/admin/formations/${formationId}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, role }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data?.error || "Erreur.");
      return;
    }
    setFirstName("");
    setCreated(data.player);
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="card">
        <div style={{ fontWeight: 800, marginBottom: 12 }}>Créer un code</div>
        <div className="sb-form">
          <label className="sb-field">
            <span>Prénom</span>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="ex. Marie"
              disabled={loading}
            />
          </label>
          <label className="sb-field">
            <span>Rôle</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={loading}
              style={{ border: "1px solid #ddd", borderRadius: 6, padding: "6px 8px", fontSize: 14 }}
            >
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {error && <div style={{ color: "#dc2626", fontSize: 14, fontWeight: 600 }}>{error}</div>}
          <button className="btn btn-main" onClick={create} disabled={loading} style={{ alignSelf: "flex-start" }}>
            {loading ? "Création…" : "Créer"}
          </button>
        </div>
      </div>

      {created && (
        <div className="card" style={{ borderLeftColor: "#16a34a", background: "#f0fdf4" }}>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>Code créé ✅</div>
          <p style={{ margin: 0, fontSize: 14 }}>
            {created.firstName} ({ROLE_LABELS[created.role] ?? created.role}) se connecte sur <code>/bafa</code> avec le code{" "}
            <span style={{ fontWeight: 900, fontSize: 18, color: "#16a34a" }}>{created.code}</span> — à lui communiquer, il ne sera pas réaffiché.
          </p>
        </div>
      )}
    </div>
  );
}
