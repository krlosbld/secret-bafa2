"use client";

import { useEffect, useState } from "react";

type PlayerRow = {
  id: string;
  firstName: string;
  points: number;
  secret: { status: string } | null;
  fake?: true; // envoyé seulement une fois la partie terminée
};

const MEDALS = ["🥇", "🥈", "🥉"];

export default function RankingClient() {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const res = await fetch("/api/poll/ranking", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      // Fin de partie : les faux joueurs sont révélés et classés à part, sans médaille.
      const shown: PlayerRow[] = data.players.filter((p: PlayerRow) => p.points > 0);
      setPlayers([...shown.filter((p) => !p.fake), ...shown.filter((p) => p.fake)]);
    } catch {
      // silencieux
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="page">
      <div className="container">
        <h1 className="h1">Classement 🏆</h1>
        <p className="sub">Mis à jour en temps réel · {players.filter((p) => !p.fake).length} participant{players.filter((p) => !p.fake).length > 1 ? "s" : ""}</p>

        {loading ? (
          <div className="card" style={{ textAlign: "center", color: "#64748b" }}>
            Chargement…
          </div>
        ) : (
          <div className="cards">
            {players.length === 0 && (
              <div className="card">
                <div className="row">
                  <div className="value">Aucun participant pour le moment.</div>
                </div>
              </div>
            )}
            {players.filter((p) => !p.fake).map((p, idx) => (
              <div
                className="card ranking-card"
                key={p.id}
                style={{
                  borderLeftColor:
                    idx === 0 ? "#f59e0b" : idx === 1 ? "#94a3b8" : idx === 2 ? "#b45309" : "#0f766e",
                }}
              >
                <div className="ranking-row">
                  <div className="ranking-rank">
                    {MEDALS[idx] ?? `#${idx + 1}`}
                  </div>
                  <div className="ranking-name">{p.firstName}</div>
                  <div className="ranking-points">{p.points} pt{p.points > 1 ? "s" : ""}</div>
                </div>
                {p.secret?.status === "FOUND" && (
                  <div style={{ fontSize: 12, color: "#16a34a", marginTop: 4, marginLeft: 76 }}>
                    Secret trouvé ✅
                  </div>
                )}
              </div>
            ))}
            {players.some((p) => p.fake) && (
              <>
                <div style={{ textAlign: "center", color: "#64748b", fontSize: 13, fontWeight: 700, margin: "8px 0 4px", textTransform: "uppercase", letterSpacing: 1 }}>
                  — Faux joueurs (hors classement) —
                </div>
                {players.filter((p) => p.fake).map((p) => (
                  <div className="card ranking-card" key={p.id} style={{ borderLeftColor: "#7c3aed", opacity: 0.8 }}>
                    <div className="ranking-row">
                      <div className="ranking-rank">🎭</div>
                      <div className="ranking-name">{p.firstName} · faux joueur</div>
                      <div className="ranking-points">{p.points} pt{p.points > 1 ? "s" : ""}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
