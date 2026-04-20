"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Secret = {
  id: string;
  content: string;
  bonus: number;
  status: string;
  createdAt: string;
  player: { firstName: string; code: string };
  foundBy: { firstName: string } | null;
};

export function AdminSecretsPending({ secrets }: { secrets: Secret[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function patch(id: string, data: object) {
    setLoading(id);
    await fetch(`/api/admin/secrets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    router.refresh();
    setLoading(null);
  }

  if (secrets.length === 0)
    return <p style={{ color: "#64748b", fontSize: 14 }}>Aucun secret en attente.</p>;

  return (
    <div className="cards">
      {secrets.map((s) => (
        <div className="card admin-card" key={s.id}>
          <div className="row">
            <div className="label">Auteur</div>
            <div className="value">{s.player.firstName} · #{s.player.code}</div>
          </div>
          <div className="row">
            <div className="label">Secret</div>
            <div className="value">{s.content}</div>
          </div>
          <div className="row">
            <div className="label">Bonus</div>
            <div className="value">+{s.bonus} pt{s.bonus > 1 ? "s" : ""}</div>
          </div>
          <div className="admin-actions" style={{ marginTop: 10 }}>
            <button
              className="btn btn-main"
              disabled={loading === s.id}
              onClick={() => patch(s.id, { status: "PUBLISHED" })}
            >
              ✅ Valider
            </button>
            <button
              className="btn btn-danger"
              disabled={loading === s.id}
              onClick={() => patch(s.id, { status: "PENDING" })}
            >
              🗑️ Rejeter
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdminSecretsPublished({ secrets }: { secrets: Secret[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function del(id: string) {
    if (!confirm("Supprimer ce secret ?")) return;
    setLoading(id);
    await fetch(`/api/admin/secrets/${id}`, { method: "DELETE" });
    router.refresh();
    setLoading(null);
  }

  if (secrets.length === 0)
    return <p style={{ color: "#64748b", fontSize: 14 }}>Aucun secret validé.</p>;

  return (
    <div className="cards">
      {secrets.map((s) => (
        <div
          className="card admin-card"
          key={s.id}
          style={{ borderLeftColor: s.status === "FOUND" ? "#16a34a" : "#0f766e" }}
        >
          <span
            className={`status-dot ${s.status === "FOUND" ? "status-dot--green" : "status-dot--green"}`}
            title={s.status}
          />
          <div className="row">
            <div className="label">Auteur</div>
            <div className="value">{s.player.firstName} · #{s.player.code}</div>
          </div>
          <div className="row">
            <div className="label">Secret</div>
            <div className="value">{s.content}</div>
          </div>
          <div className="row">
            <div className="label">Statut</div>
            <div className="value">
              {s.status === "FOUND"
                ? `Trouvé par ${s.foundBy?.firstName ?? "?"} 🎯`
                : "En jeu ⏳"}
            </div>
          </div>
          <div className="row">
            <div className="label">Bonus</div>
            <div className="value">+{s.bonus} pt{s.bonus > 1 ? "s" : ""}</div>
          </div>
          <div className="admin-actions" style={{ marginTop: 10 }}>
            <button
              className="btn btn-danger"
              disabled={loading === s.id}
              onClick={() => del(s.id)}
            >
              Supprimer
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
