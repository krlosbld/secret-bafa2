"use client";

import { useEffect, useState } from "react";

type Buzz = {
  id: string;
  fromName: string;
  toName: string;
  createdAt: string;
  secret: {
    id: string;
    content: string;
    status: string;
  } | null;
};

export default function BuzzAdmin() {
  const [buzzes, setBuzzes] = useState<Buzz[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 🔹 Charger les buzz
  async function loadBuzzes() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/buzz", { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "Erreur");

      setBuzzes(data.buzzes || []);
    } catch (error) {
      console.error(error);
      alert("Erreur lors du chargement des buzz");
    } finally {
      setLoading(false);
    }
  }

  // 🔹 Supprimer un buzz
  async function deleteBuzz(id: string) {
    const ok = window.confirm("Supprimer ce buzz ?");
    if (!ok) return;

    try {
      setDeletingId(id);

      const res = await fetch(`/api/admin/buzz/${id}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data?.error || "Erreur");

      setBuzzes((prev) => prev.filter((buzz) => buzz.id !== id));
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la suppression");
    } finally {
      setDeletingId(null);
    }
  }

  // 🔹 Supprimer TOUS les buzz
  async function deleteAllBuzz() {
    const ok = window.confirm("Supprimer TOUS les buzz ?");
    if (!ok) return;

    try {
      setLoading(true);

      const res = await fetch("/api/admin/buzz", {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data?.error || "Erreur");

      setBuzzes([]);
      alert("Tous les buzz ont été supprimés");
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la suppression globale");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBuzzes();
  }, []);

  if (loading) {
    return <div className="card">Chargement des buzz...</div>;
  }

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <h2 style={{ marginTop: 0 }}>Buzz</h2>

      {/* compteur */}
      <p style={{ fontSize: 14, opacity: 0.7 }}>
        {buzzes.length} buzz enregistrés
      </p>

      {buzzes.length === 0 ? (
        <p>Aucun buzz enregistré.</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {buzzes.map((buzz) => (
            <div
              key={buzz.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 14,
                padding: 14,
                background: "#fff",
              }}
            >
              <div style={{ fontWeight: 700 }}>
                {buzz.fromName} a buzzé {buzz.toName}
              </div>

              <div style={{ marginTop: 6, fontSize: 14, opacity: 0.8 }}>
                Secret lié :{" "}
                {buzz.secret ? `"${buzz.secret.content}"` : "Secret supprimé"}
              </div>

              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.65 }}>
                Statut du secret : {buzz.secret?.status ?? "inconnu"}
              </div>

              <div style={{ marginTop: 12 }}>
                <button
                  onClick={() => deleteBuzz(buzz.id)}
                  disabled={deletingId === buzz.id}
                  style={{
                    background: "#dc2626",
                    color: "white",
                    border: "none",
                    padding: "8px 12px",
                    borderRadius: 10,
                    fontWeight: 700,
                    cursor: "pointer",
                    opacity: deletingId === buzz.id ? 0.7 : 1,
                  }}
                >
                  {deletingId === buzz.id ? "Suppression..." : "Supprimer"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 🔥 bouton global */}
      <div style={{ marginTop: 20, textAlign: "center" }}>
        <button
          onClick={deleteAllBuzz}
          disabled={loading || buzzes.length === 0}
          style={{
            background: "#991b1b",
            color: "white",
            border: "none",
            padding: "10px 16px",
            borderRadius: 12,
            fontWeight: 800,
            cursor: "pointer",
            opacity: loading || buzzes.length === 0 ? 0.6 : 1,
          }}
        >
          🗑️ Supprimer tous les buzz
        </button>
      </div>
    </div>
  );
}