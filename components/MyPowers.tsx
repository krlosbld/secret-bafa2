"use client";

import { useEffect, useState } from "react";
import type { MysteryState } from "@/lib/mysteryBuzz";

// « Mes pouvoirs » (onglet Jeu, joueur) : uniquement les pouvoirs du joueur connecté — pour l'instant
// le Buzz mystère : disponible, question en attente, refusée (à reformuler), ou utilisé (réponse).
// Rafraîchi régulièrement pour voir arriver la réponse du maître du jeu.
const STATUS: Record<string, { label: string; tone: string }> = {
  PENDING: { label: "En attente de la réponse du maître du jeu", tone: "#b45309" },
  ANSWERED: { label: "Réponse", tone: "#15803d" },
  REFUSED: { label: "Refusée — tu peux reformuler", tone: "#b91c1c" },
  CLOSED: { label: "Close (partie terminée)", tone: "#64748b" },
};

export default function MyPowers({ initial }: { initial: MysteryState }) {
  const [state, setState] = useState(initial);

  useEffect(() => {
    const id = setInterval(async () => {
      const res = await fetch("/api/game/mystery", { cache: "no-store" }).catch(() => null);
      const data = res?.ok ? await res.json().catch(() => null) : null;
      if (data?.ok) setState({ enabled: data.enabled, available: data.available, reason: data.reason, questions: data.questions });
    }, 20000);
    return () => clearInterval(id);
  }, []);

  const answered = state.questions.find((q) => q.status === "ANSWERED");
  return (
    <section className="card my-powers" style={{ marginBottom: 20 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>Mes pouvoirs</div>
      <div className="my-powers__item">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <strong>❓ Buzz mystère</strong>
          <span style={{ fontSize: 13, fontWeight: 700, color: state.available ? "#15803d" : answered ? "#64748b" : "#b45309" }}>
            {state.available ? "Disponible" : answered ? "Utilisé" : state.reason}
          </span>
        </div>
        <p style={{ fontSize: 13, color: "#475569", margin: "4px 0 0" }}>
          Une fois par partie, pose au maître du jeu une question fermée sur un secret : il répond seulement « Oui » ou « Non ». Pas de
          question sur l&apos;identité de l&apos;auteur (prénom, groupe, rôle, genre…). Gratuit, hors quota de buzz, de 9 h à 18 h.
          {state.available && " Utilise le bouton « ❓ Buzz mystère » sous le secret de ton choix."}
        </p>
        {state.questions.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "flex", flexDirection: "column", gap: 8 }}>
            {state.questions.map((q) => (
              <li key={q.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 10px", fontSize: 13 }}>
                <div style={{ color: "#64748b" }}>
                  Secret : « {q.secretContent} »
                </div>
                <div style={{ fontWeight: 700, margin: "2px 0" }}>{q.text}</div>
                <div style={{ color: STATUS[q.status]?.tone ?? "#475569", fontWeight: 700 }}>
                  {STATUS[q.status]?.label ?? q.status}
                  {q.status === "ANSWERED" && ` : ${q.answer === "OUI" ? "✅ Oui" : "❌ Non"}`}
                </div>
                {q.status === "REFUSED" && q.refusalReason && <div style={{ color: "#7f1d1d" }}>Motif : {q.refusalReason}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
