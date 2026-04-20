"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Manager = { id: string; username: string; createdAt: string };

export default function AdminManagers({ managers }: { managers: Manager[] }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function create() {
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("Identifiant et mot de passe requis.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/admin/managers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data?.error || "Erreur.");
      return;
    }
    setUsername("");
    setPassword("");
    router.refresh();
  }

  async function del(id: string, name: string) {
    if (!confirm(`Supprimer le gestionnaire "${name}" ?`)) return;
    setDeleting(id);
    await fetch(`/api/admin/managers/${id}`, { method: "DELETE" });
    router.refresh();
    setDeleting(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Création */}
      <div className="card">
        <div style={{ fontWeight: 800, marginBottom: 12 }}>Créer un gestionnaire</div>
        <div className="sb-form">
          <label className="sb-field">
            <span>Identifiant</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="identifiant"
              disabled={loading}
            />
          </label>
          <label className="sb-field">
            <span>Mot de passe</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
            />
          </label>
          {error && (
            <div style={{ color: "#dc2626", fontSize: 14, fontWeight: 600 }}>{error}</div>
          )}
          <button
            className="btn btn-main"
            onClick={create}
            disabled={loading}
            style={{ alignSelf: "flex-start" }}
          >
            {loading ? "Création…" : "Créer"}
          </button>
        </div>
      </div>

      {/* Liste */}
      {managers.length === 0 ? (
        <p style={{ color: "#64748b", fontSize: 14 }}>Aucun gestionnaire.</p>
      ) : (
        managers.map((m) => (
          <div
            className="card"
            key={m.id}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
          >
            <div>
              <span style={{ fontWeight: 800 }}>{m.username}</span>
              <span style={{ color: "#64748b", fontSize: 13, marginLeft: 10 }}>
                Créé le {new Date(m.createdAt).toLocaleDateString("fr-FR")}
              </span>
            </div>
            <button
              className="btn btn-danger"
              disabled={deleting === m.id}
              onClick={() => del(m.id, m.username)}
            >
              Supprimer
            </button>
          </div>
        ))
      )}
    </div>
  );
}
