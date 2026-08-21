"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Secret = {
  id: string;
  content: string;
  bonus: number;
  status: string;
  flagged: boolean;
  isDecoy: boolean;
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
  const [showDecoyForm, setShowDecoyForm] = useState(false);
  const [decoyProposal, setDecoyProposal] = useState<{ firstName: string; content: string; source?: string } | null>(null);
  const [decoyPoints, setDecoyPoints] = useState(3);
  const [decoyError, setDecoyError] = useState("");
  const [generatingDecoy, setGeneratingDecoy] = useState(false);
  const [creatingDecoy, setCreatingDecoy] = useState(false);

  async function generateDecoy() {
    setDecoyError("");
    setGeneratingDecoy(true);
    try {
      const res = await fetch("/api/admin/secrets/decoy/generate", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDecoyError(data?.error || "Erreur.");
        return;
      }
      setDecoyProposal({ firstName: data.firstName, content: data.content, source: data.source });
    } catch {
      setDecoyError("Erreur réseau.");
    } finally {
      setGeneratingDecoy(false);
    }
  }

  function openDecoyForm() {
    setShowDecoyForm(true);
    setDecoyProposal(null);
    setDecoyPoints(3);
    setDecoyError("");
    void generateDecoy();
  }

  async function createDecoy() {
    if (!decoyProposal) return;
    setDecoyError("");
    setCreatingDecoy(true);
    try {
      const res = await fetch("/api/admin/secrets/decoy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: decoyProposal.firstName, content: decoyProposal.content, points: decoyPoints }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDecoyError(data?.error || "Erreur.");
        return;
      }
      setShowDecoyForm(false);
      setDecoyProposal(null);
      router.refresh();
    } catch {
      setDecoyError("Erreur réseau.");
    } finally {
      setCreatingDecoy(false);
    }
  }

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

  return (
    <>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        {secrets.length > 0 && (
          <button className="btn btn-main" onClick={publishAll} disabled={loadingAll}>
            {loadingAll ? "Validation…" : `✅ Tout valider (${secrets.length})`}
          </button>
        )}
        <button className="btn btn-ghost" onClick={() => (showDecoyForm ? setShowDecoyForm(false) : openDecoyForm())}>
          🎭 Générer un faux secret
        </button>
      </div>

      {showDecoyForm && (
        <div className="card" style={{ marginBottom: 14 }}>
          {generatingDecoy || !decoyProposal ? (
            <p style={{ color: "#64748b", fontSize: 14 }}>Génération…</p>
          ) : (
            <>
              {decoyProposal.source === "fallback" && (
                <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: 10, color: "#92400e", fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
                  ⚠️ Génération IA indisponible — secret de secours proposé, modifie-le si besoin.
                </div>
              )}
              <label className="sb-field">
                <span>Prénom proposé</span>
                <input
                  value={decoyProposal.firstName}
                  onChange={(e) => setDecoyProposal((p) => (p ? { ...p, firstName: e.target.value } : p))}
                  maxLength={40}
                  disabled={creatingDecoy}
                />
              </label>
              <label className="sb-field">
                <span>Secret proposé</span>
                <textarea
                  value={decoyProposal.content}
                  onChange={(e) => setDecoyProposal((p) => (p ? { ...p, content: e.target.value } : p))}
                  rows={3}
                  disabled={creatingDecoy}
                  style={{ resize: "vertical" }}
                />
              </label>
              <button className="btn btn-ghost" onClick={generateDecoy} disabled={creatingDecoy} style={{ marginTop: 6, marginBottom: 6 }}>
                🎲 Regénérer
              </button>
            </>
          )}
          <label className="sb-field">
            <span>Points gagnés si trouvé</span>
            <input
              type="number"
              min={1}
              max={20}
              value={decoyPoints}
              onChange={(e) => setDecoyPoints(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
              disabled={creatingDecoy}
              style={{ width: 90 }}
            />
          </label>
          {decoyError && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: 10, color: "#dc2626", fontWeight: 600, fontSize: 14, marginBottom: 10 }}>
              {decoyError}
            </div>
          )}
          <div className="sb-actions">
            <button className="btn btn-ghost" onClick={() => setShowDecoyForm(false)} disabled={creatingDecoy}>
              Annuler
            </button>
            <button className="btn btn-main" onClick={createDecoy} disabled={creatingDecoy || !decoyProposal}>
              {creatingDecoy ? "Création…" : "Créer"}
            </button>
          </div>
        </div>
      )}

      {secrets.length === 0 ? (
        <p style={{ color: "#64748b", fontSize: 14 }}>Aucun secret en attente.</p>
      ) : (
    <div className="cards">
      {secrets.map((s) => (
        <div className="card admin-card" key={s.id} style={s.flagged ? { borderLeftColor: "#f59e0b", background: "#fffbeb" } : undefined}>
          {s.isDecoy && (
            <div style={{ background: "#6b21a8", color: "#fff", fontWeight: 800, fontSize: 12, borderRadius: 6, padding: "3px 10px", marginBottom: 8, display: "inline-block" }}>
              🎭 Faux secret
            </div>
          )}
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
            <div className="label">{s.isDecoy ? "Points" : "Bonus"}</div>
            <div className="value">
              {s.isDecoy ? s.bonus : `+${s.bonus}`} pt{s.bonus > 1 ? "s" : ""}
            </div>
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
      )}
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

  async function unpublish(id: string) {
    if (!confirm("Repasser ce secret en attente ? Il ne sera plus visible sur la page publique.")) return;
    setLoading(id);
    await fetch(`/api/admin/secrets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PENDING" }),
    });
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
          {s.isDecoy && (
            <div style={{ background: "#6b21a8", color: "#fff", fontWeight: 800, fontSize: 12, borderRadius: 6, padding: "3px 10px", marginBottom: 8, display: "inline-block" }}>
              🎭 Faux secret
            </div>
          )}
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
            <div className="label">{s.isDecoy ? "Points" : "Bonus"}</div>
            <div className="value">
              {s.isDecoy ? s.bonus : `+${s.bonus}`} pt{s.bonus > 1 ? "s" : ""}
            </div>
          </div>
          <div className="admin-actions" style={{ marginTop: 10 }}>
            <button
              className="btn btn-ghost"
              disabled={loading === s.id}
              onClick={() => unpublish(s.id)}
            >
              ↩️ Repasser en attente
            </button>
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
