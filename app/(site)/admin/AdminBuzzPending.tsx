"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type BuzzItem = {
  id: string;
  guessedName: string;
  isCorrect: boolean;
  createdAt: string;
  fromPlayer: { firstName: string; code: string };
  secret: {
    content: string;
    bonus: number;
    player: { firstName: string };
  };
};

export default function AdminBuzzPending({ buzzes }: { buzzes: BuzzItem[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function act(id: string, action: "validate" | "reject") {
    setLoading(id);
    await fetch(`/api/admin/buzz/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    router.refresh();
    setLoading(null);
  }

  if (buzzes.length === 0)
    return <p style={{ color: "#64748b", fontSize: 14 }}>Aucun buzz en attente.</p>;

  return (
    <div className="cards">
      {buzzes.map((b) => (
        <div
          className="card"
          key={b.id}
          style={{
            borderLeftColor: b.isCorrect ? "#16a34a" : "#e11d48",
          }}
        >
          <div className="row">
            <div className="label">Buzzeur</div>
            <div className="value">{b.fromPlayer.firstName} · #{b.fromPlayer.code}</div>
          </div>
          <div className="row">
            <div className="label">Secret</div>
            <div className="value" style={{ fontStyle: "italic" }}>"{b.secret.content}"</div>
          </div>
          <div className="row">
            <div className="label">Réponse</div>
            <div
              className="value"
              style={{
                color: b.isCorrect ? "#16a34a" : "#e11d48",
                fontWeight: 900,
              }}
            >
              {b.guessedName} {b.isCorrect ? "✅ correct" : "❌ incorrect"}
            </div>
          </div>
          {b.isCorrect && (
            <div className="row">
              <div className="label">Gain</div>
              <div className="value" style={{ color: "#0f766e" }}>
                +{2 + b.secret.bonus} pts (2 + {b.secret.bonus} bonus)
              </div>
            </div>
          )}
          <div className="admin-actions" style={{ marginTop: 10 }}>
            <button
              className="btn btn-main"
              disabled={loading === b.id}
              onClick={() => act(b.id, "validate")}
            >
              ✅ Valider
            </button>
            <button
              className="btn btn-danger"
              disabled={loading === b.id}
              onClick={() => act(b.id, "reject")}
            >
              ❌ Rejeter
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
