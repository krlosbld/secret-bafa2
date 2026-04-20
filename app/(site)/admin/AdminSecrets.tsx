"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Secret = {
  id: string;
  content: string;
  bonus: number;
  status: string;
  flagged: boolean;
  createdAt: string;
  player: { firstName: string; code: string };
  foundBy: { firstName: string } | null;
};

export function AdminSecretsPending({ secrets }: { secrets: Secret[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

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

  async function saveContent(id: string) {
    if (!editValue.trim()) return;
    setLoading(id);
    await fetch(`/api/admin/secrets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editValue.trim() }),
    });
    setEditingId(null);
    router.refresh();
    setLoading(null);
  }

  async function publishAll() {
    if (!confirm(`Valider les ${secrets.length} secrets en attente ?`)) return;
    setLoadingAll(true);
    await fetch("/api/admin/secrets/publish-all", { method: "POST" });
    router.refresh();
    setLoadingAll(false);
  }

  if (secrets.length === 0)
    return <p style={{ color: "#64748b", fontSize: 14 }}>Aucun secret en attente.</p>;

  return (
    <>
      <button
        className="btn btn-main"
        onClick={publishAll}
        disabled={loadingAll}
        style={{ marginBottom: 14 }}
      >
        {loadingAll ? "Validation…" : `✅ Tout valider (${secrets.length})`}
      </button>
    <div className="cards">
      {secrets.map((s) => (
        <div className="card admin-card" key={s.id} style={s.flagged ? { borderLeftColor: "#f59e0b", background: "#fffbeb" } : undefined}>
          {s.flagged && (
            <div style={{ background: "#f59e0b", color: "#fff", fontWeight: 800, fontSize: 12, borderRadius: 6, padding: "3px 10px", marginBottom: 8, display: "inline-block" }}>
              ⚠️ Contenu à vérifier
            </div>
          )}
          <div className="row">
            <div className="label">Auteur</div>
            <div className="value">{s.player.firstName} · #{s.player.code}</div>
          </div>
          <div className="row">
            <div className="label">Secret</div>
            <div className="value" style={{ display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
              {editingId === s.id ? (
                <>
                  <textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    rows={3}
                    style={{ border: "1px solid #0f766e", borderRadius: 6, padding: "4px 8px", fontSize: 14, width: "100%", resize: "vertical" }}
                    autoFocus
                  />
                  <button className="btn btn-main" style={{ padding: "2px 10px" }} onClick={() => saveContent(s.id)} disabled={loading === s.id}>✓</button>
                  <button className="btn btn-ghost" style={{ padding: "2px 10px" }} onClick={() => setEditingId(null)}>✕</button>
                </>
              ) : (
                <>
                  <span>{s.content}</span>
                  <button className="btn btn-ghost" style={{ padding: "1px 8px", fontSize: 12 }} onClick={() => { setEditingId(s.id); setEditValue(s.content); }}>✏️</button>
                </>
              )}
            </div>
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
    </>
  );
}

export function AdminSecretsPublished({ secrets }: { secrets: Secret[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? secrets : secrets.slice(0, 5);

  async function saveContent(id: string) {
    if (!editValue.trim()) return;
    setLoading(id);
    await fetch(`/api/admin/secrets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editValue.trim() }),
    });
    setEditingId(null);
    router.refresh();
    setLoading(null);
  }

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
    <>
    <div className="cards">
      {visible.map((s) => (
        <div
          className="card admin-card"
          key={s.id}
          style={{ borderLeftColor: s.flagged ? "#f59e0b" : s.status === "FOUND" ? "#16a34a" : "#0f766e", background: s.flagged ? "#fffbeb" : undefined }}
        >
          {s.flagged && (
            <div style={{ background: "#f59e0b", color: "#fff", fontWeight: 800, fontSize: 12, borderRadius: 6, padding: "3px 10px", marginBottom: 8, display: "inline-block" }}>
              ⚠️ Contenu à vérifier
            </div>
          )}
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
            <div className="value" style={{ display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
              {editingId === s.id ? (
                <>
                  <textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    rows={3}
                    style={{ border: "1px solid #0f766e", borderRadius: 6, padding: "4px 8px", fontSize: 14, width: "100%", resize: "vertical" }}
                    autoFocus
                  />
                  <button className="btn btn-main" style={{ padding: "2px 10px" }} onClick={() => saveContent(s.id)} disabled={loading === s.id}>✓</button>
                  <button className="btn btn-ghost" style={{ padding: "2px 10px" }} onClick={() => setEditingId(null)}>✕</button>
                </>
              ) : (
                <>
                  <span>{s.content}</span>
                  <button className="btn btn-ghost" style={{ padding: "1px 8px", fontSize: 12 }} onClick={() => { setEditingId(s.id); setEditValue(s.content); }}>✏️</button>
                </>
              )}
            </div>
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
    {secrets.length > 5 && (
      <button
        className="btn btn-ghost"
        onClick={() => setShowAll((v) => !v)}
        style={{ marginTop: 12 }}
      >
        {showAll ? "Afficher moins ▲" : `Afficher plus (${secrets.length - 5} de plus) ▼`}
      </button>
    )}
    </>
  );
}
