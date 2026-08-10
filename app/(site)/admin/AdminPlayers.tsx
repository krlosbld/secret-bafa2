"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Player = {
  id: string;
  firstName: string;
  code: string;
  role: string;
  points: number;
  buzzCount: number;
  secret: { status: string; content: string; bonus: number } | null;
};

const ROLE_LABELS: Record<string, string> = {
  STAGIAIRE: "Stagiaire",
  FORMATEUR: "Formateur",
  DIRECTEUR: "Directeur",
};

export default function AdminPlayers({
  players,
  quota,
  showQuota = true,
}: {
  players: Player[];
  quota: number;
  showQuota?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [newQuota, setNewQuota] = useState(quota);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? players : players.slice(0, 5);
  const [savingQuota, setSavingQuota] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [nameValue, setNameValue] = useState("");

  async function patchPlayer(id: string, data: object) {
    setLoading(id);
    await fetch(`/api/admin/players/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    router.refresh();
    setLoading(null);
  }

  async function deletePlayer(id: string, name: string) {
    if (!confirm(`Supprimer ${name} et toutes ses données ?`)) return;
    setLoading(id);
    await fetch(`/api/admin/players/${id}`, { method: "DELETE" });
    router.refresh();
    setLoading(null);
  }

  async function saveName(id: string) {
    if (!nameValue.trim()) return;
    setLoading(id);
    await fetch(`/api/admin/players/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: nameValue.trim() }),
    });
    setEditingName(null);
    router.refresh();
    setLoading(null);
  }

  async function saveQuota() {
    setSavingQuota(true);
    await fetch("/api/admin/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buzzQuota: newQuota }),
    });
    router.refresh();
    setSavingQuota(false);
  }

  return (
    <>
      {/* Quota */}
      {showQuota && (
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Quota de buzz par personne</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            className="btn btn-ghost"
            onClick={() => setNewQuota((v) => Math.max(1, v - 1))}
          >
            −
          </button>
          <span style={{ fontWeight: 900, fontSize: 20, minWidth: 32, textAlign: "center" }}>
            {newQuota}
          </span>
          <button
            className="btn btn-ghost"
            onClick={() => setNewQuota((v) => Math.min(20, v + 1))}
          >
            +
          </button>
          <button
            className="btn btn-main"
            onClick={saveQuota}
            disabled={savingQuota || newQuota === quota}
          >
            {savingQuota ? "Sauvegarde…" : "Enregistrer"}
          </button>
        </div>
      </div>
      )}

      {/* Liste joueurs */}
      <div className="cards">
        {visible.map((p) => (
          <div className="card admin-card" key={p.id}>
            <div className="row">
              <div className="label">Joueur</div>
              <div className="value" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {editingName === p.id ? (
                  <>
                    <input
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveName(p.id); if (e.key === "Escape") setEditingName(null); }}
                      style={{ border: "1px solid #0f766e", borderRadius: 6, padding: "2px 8px", fontSize: 14, width: 140 }}
                      autoFocus
                    />
                    <button className="btn btn-main" style={{ padding: "2px 10px" }} onClick={() => saveName(p.id)} disabled={loading === p.id}>✓</button>
                    <button className="btn btn-ghost" style={{ padding: "2px 10px" }} onClick={() => setEditingName(null)}>✕</button>
                  </>
                ) : (
                  <>
                    {p.firstName} · <span style={{ color: "#0f766e", fontWeight: 900 }}>#{p.code}</span>
                    <button className="btn btn-ghost" style={{ padding: "1px 8px", fontSize: 12 }} onClick={() => { setEditingName(p.id); setNameValue(p.firstName); }}>✏️</button>
                  </>
                )}
              </div>
            </div>
            <div className="row">
              <div className="label">Rôle</div>
              <div className="value">
                <select
                  value={p.role}
                  disabled={loading === p.id}
                  onChange={(e) => patchPlayer(p.id, { role: e.target.value })}
                  style={{ border: "1px solid #ddd", borderRadius: 6, padding: "3px 6px", fontSize: 13 }}
                >
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="row">
              <div className="label">Buzz</div>
              <div className="value">
                {p.buzzCount} / {quota}
              </div>
            </div>
            <div className="row">
              <div className="label">Points</div>
              <div className="value" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  className="btn btn-ghost"
                  style={{ padding: "2px 10px" }}
                  disabled={loading === p.id}
                  onClick={() => patchPlayer(p.id, { points: p.points - 1 })}
                >
                  −
                </button>
                <span style={{ fontWeight: 900, fontSize: 18, minWidth: 36, textAlign: "center" }}>
                  {p.points}
                </span>
                <button
                  className="btn btn-ghost"
                  style={{ padding: "2px 10px" }}
                  disabled={loading === p.id}
                  onClick={() => patchPlayer(p.id, { points: p.points + 1 })}
                >
                  +
                </button>
              </div>
            </div>
            {p.secret && (
              <div className="row">
                <div className="label">Secret</div>
                <div className="value" style={{ fontStyle: "italic", fontSize: "0.9rem" }}>
                  "{p.secret.content.slice(0, 60)}{p.secret.content.length > 60 ? "…" : ""}"
                  <span style={{ marginLeft: 8, fontSize: 12, color: p.secret.status === "FOUND" ? "#16a34a" : "#64748b" }}>
                    ({p.secret.status === "FOUND" ? "trouvé" : p.secret.status === "PUBLISHED" ? "en jeu" : "en attente"})
                  </span>
                </div>
              </div>
            )}
            <div className="admin-actions" style={{ marginTop: 10 }}>
              <button
                className="btn btn-ghost"
                disabled={loading === p.id}
                onClick={() => patchPlayer(p.id, { resetBuzz: true })}
              >
                🔄 Reset buzz
              </button>
              <button
                className="btn btn-danger"
                disabled={loading === p.id}
                onClick={() => deletePlayer(p.id, p.firstName)}
              >
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>
      {players.length > 5 && (
        <button
          className="btn btn-ghost"
          onClick={() => setShowAll((v) => !v)}
          style={{ marginTop: 12 }}
        >
          {showAll ? "Afficher moins ▲" : `Afficher plus (${players.length - 5} de plus) ▼`}
        </button>
      )}
    </>
  );
}
