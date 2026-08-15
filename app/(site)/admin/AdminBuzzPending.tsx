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

function dayKey(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(iso));
}

function dayLabel(iso: string) {
  const label = new Date(iso).toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Regroupe par jour (heure de Paris) en conservant l'ordre chronologique déjà appliqué par la requête
// (createdAt asc) — donc les jours ressortent eux aussi du plus ancien au plus récent.
function groupByDay(buzzes: BuzzItem[]): { key: string; label: string; items: BuzzItem[] }[] {
  const groups: { key: string; label: string; items: BuzzItem[] }[] = [];
  for (const b of buzzes) {
    const key = dayKey(b.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(b);
    } else {
      groups.push({ key, label: dayLabel(b.createdAt), items: [b] });
    }
  }
  return groups;
}

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

  const groups = groupByDay(buzzes);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {groups.map((group) => (
        <div key={group.key}>
          <div
            style={{
              fontWeight: 800,
              fontSize: 13,
              color: "#0f766e",
              marginBottom: 8,
              paddingBottom: 4,
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            📅 {group.label} · {group.items.length} buzz
          </div>
          <div className="cards">
            {group.items.map((b) => (
              <div
                className="card"
                key={b.id}
                style={{
                  borderLeftColor: b.isCorrect ? "#16a34a" : "#e11d48",
                }}
              >
                <div className="row">
                  <div className="label">Buzzeur</div>
                  <div className="value">
                    {b.fromPlayer.firstName} · #{b.fromPlayer.code}
                    <span style={{ marginLeft: 8, fontSize: 12, color: "#94a3b8" }}>
                      {new Date(b.createdAt).toLocaleString("fr-FR", {
                        timeZone: "Europe/Paris",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
                <div className="row">
                  <div className="label">Secret</div>
                  <div className="value" style={{ fontStyle: "italic" }}>&quot;{b.secret.content}&quot;</div>
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
        </div>
      ))}
    </div>
  );
}
