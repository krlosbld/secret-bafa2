"use client";

import { useEffect, useState, useCallback } from "react";
import BuzzButton from "./BuzzButton";

type SecretItem = {
  id: string;
  content: string;
  status: string;
  bonus: number;
  player: { firstName: string };
  foundBy: { firstName: string } | null;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function SecretsClient({ initial }: { initial: SecretItem[] }) {
  const [secrets, setSecrets] = useState<SecretItem[]>(() => shuffle(initial));

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/poll/secrets", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setSecrets((prev) => {
        const incoming: SecretItem[] = data.secrets;
        // Garder l'ordre aléatoire actuel pour les secrets déjà présents
        const prevIds = new Set(prev.map((s) => s.id));
        const newOnes = shuffle(incoming.filter((s) => !prevIds.has(s.id) && s.status !== "FOUND"));
        const updated = prev.map((s) => incoming.find((i) => i.id === s.id) ?? s);
        const found = incoming.filter((s) => s.status === "FOUND");
        const notFound = [...updated.filter((s) => s.status !== "FOUND"), ...newOnes];
        return [...notFound, ...found];
      });
    } catch {
      // silencieux
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  const notFound = secrets.filter((s) => s.status !== "FOUND");
  const found = secrets.filter((s) => s.status === "FOUND");

  return (
    <div className="cards">
      {notFound.map((s) => (
        <div className="card" key={s.id}>
          <div className="row">
            <div className="label">Secret</div>
            <div className="value">{s.content}</div>
          </div>
          <div className="row">
            <div className="label">Bonus</div>
            <div className="value" style={{ color: "#0f766e" }}>
              +{s.bonus} pt{s.bonus > 1 ? "s" : ""}
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <BuzzButton secretId={s.id} />
          </div>
        </div>
      ))}

      {notFound.length === 0 && found.length === 0 && (
        <div className="card">
          <div className="row">
            <div className="label">Info</div>
            <div className="value">Aucun secret publié pour le moment.</div>
          </div>
        </div>
      )}

      {found.length > 0 && (
        <>
          <div
            style={{
              textAlign: "center",
              color: "#64748b",
              fontSize: 13,
              fontWeight: 700,
              margin: "8px 0 4px",
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            — Secrets trouvés —
          </div>
          {found.map((s) => (
            <div
              className="card"
              key={s.id}
              style={{ borderLeftColor: "#16a34a", opacity: 0.75 }}
            >
              <div className="row">
                <div className="label">Secret</div>
                <div className="value">{s.content}</div>
              </div>
              <div className="row">
                <div className="label">Auteur</div>
                <div className="value" style={{ color: "#16a34a", fontWeight: 900 }}>
                  {s.player.firstName} ✅
                </div>
              </div>
              {s.foundBy && (
                <div className="row">
                  <div className="label">Trouvé par</div>
                  <div className="value">{s.foundBy.firstName} 🎯</div>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
