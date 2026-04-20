"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Player = {
  id: string;
  firstName: string;
  code: string;
  points: number;
  buzzCount: number;
  secret: { status: string; content: string; bonus: number } | null;
};

export default function AdminPlayers({
  players,
  quota,
}: {
  players: Player[];
  quota: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [newQuota, setNewQuota] = useState(quota);
  const [savingQuota, setSavingQuota] = useState(false);

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

      {/* Liste joueurs */}
      <div className="cards">
        {players.map((p) => (
          <div className="card admin-card" key={p.id}>
            <div className="row">
              <div className="label">Joueur</div>
              <div className="value">
                {p.firstName} · <span style={{ color: "#0f766e", fontWeight: 900 }}>#{p.code}</span>
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
    </>
  );
}
