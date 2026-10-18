"use client";

import { useEffect, useState, useCallback } from "react";
import BuzzButton from "./BuzzButton";
import HistoryRevealButton from "./HistoryRevealButton";

type SecretItem = {
  id: string;
  content: string;
  status: string;
  bonus: number;
  revealCost: number;
  player: { firstName: string } | null; // auteur : envoyé seulement une fois le secret trouvé
  foundBy: { firstName: string } | null;
};

// Générateur pseudo-aléatoire déterministe (mulberry32) : à partir de la même graine, le serveur et
// le navigateur produisent exactement le même ordre — pas d'écart d'hydratation (erreur React #418).
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], random: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// canPlay : participant d'une partie en cours (boutons de buzz) ; l'équipe et le maître du jeu consultent seulement.
export default function SecretsClient({
  initial,
  historyRevealEnabled,
  canPlay = true,
  shuffleSeed,
}: {
  initial: SecretItem[];
  historyRevealEnabled: boolean;
  canPlay?: boolean;
  shuffleSeed: number; // tirée par le serveur à chaque affichage : ordre aléatoire, identique des deux côtés
}) {
  const [secrets, setSecrets] = useState<SecretItem[]>(() => shuffle(initial, seededRandom(shuffleSeed)));
  const [toast, setToast] = useState(() => initial.some((s) => s.status === "FOUND"));

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(false), 10000);
    return () => clearTimeout(t);
  }, [toast]);

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
    <>
    {toast && (
      <div style={{
        position: "fixed",
        bottom: 80,
        left: 24,
        zIndex: 999,
        background: "#0f766e",
        color: "#fff",
        borderRadius: 12,
        padding: "12px 20px",
        fontWeight: 700,
        fontSize: 15,
        boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
        animation: "fadeIn 0.3s ease",
      }}>
        🎯 Un secret a été trouvé !
      </div>
    )}
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
          {s.player && (
            <div className="row">
              <div className="label">Auteur</div>
              <div className="value" style={{ fontWeight: 800 }}>
                {s.player.firstName} (non trouvé)
              </div>
            </div>
          )}
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {canPlay && <BuzzButton secretId={s.id} />}
            {canPlay && historyRevealEnabled && <HistoryRevealButton secretId={s.id} cost={s.revealCost} />}
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
                  {s.player?.firstName ?? "?"} ✅
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
    </>
  );
}
