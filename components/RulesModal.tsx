"use client";

import { useState } from "react";

const rules = [
  {
    emoji: "✍️",
    title: "Soumets ton secret",
    text: "Chaque participant soumet un secret sur lui-même via le bouton \"Ajouter mon secret\". Un seul secret par personne.",
  },
  {
    emoji: "🔑",
    title: "Note ton code",
    text: "Après envoi, un code unique à 4 chiffres t'est attribué (ex: #4823). Note-le bien, tu en auras besoin pour jouer. Sans ce code, impossible de participer.",
  },
  {
    emoji: "⏳",
    title: "Attends la validation",
    text: "L'animateur valide les secrets avant qu'ils apparaissent sur la page publique. Les secrets sont affichés anonymement.",
  },
  {
    emoji: "⚡",
    title: "Buzze !",
    text: "Tu penses reconnaître l'auteur d'un secret ? Clique sur BUZZ 🔥, entre ton prénom, ton code et le prénom que tu devines.",
  },
  {
    emoji: "🎯",
    title: "Quota de buzz",
    text: "Tu ne peux buzzer qu'un nombre limité de fois (fixé par l'animateur). Choisis bien tes secrets !",
  },
  {
    emoji: "🚫",
    title: "Un seul buzz par secret",
    text: "Tu ne peux buzzer qu'une seule fois par secret.",
  },
  {
    emoji: "🌙",
    title: "Validation le soir",
    text: "C'est l'animateur qui valide les buzz chaque soir. Si tu as trouvé le bon auteur, tu gagnes 2 points + les points bonus attribués par l'auteur.",
  },
  {
    emoji: "⭐",
    title: "Points bonus",
    text: "En soumettant ton secret, tu lui attribues de 1 à 5 points bonus. Plus ton secret est difficile à deviner, plus tu mets de points !",
  },
  {
    emoji: "🌟",
    title: "Secret non trouvé",
    text: "Chaque nuit, si ton secret n'a pas encore été trouvé, tu gagnes automatiquement 1 point.",
  },
  {
    emoji: "🏆",
    title: "Vainqueur",
    text: "Le participant avec le plus de points à la fin du séjour remporte le jeu !",
  },
];

export default function RulesModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Règles du jeu"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 1000,
          background: "#0f766e",
          border: "none",
          color: "#fff",
          borderRadius: "50%",
          width: 48,
          height: 48,
          fontWeight: 900,
          fontSize: 22,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
        }}
      >
        ?
      </button>

      {open && (
        <div className="sb-backdrop" onMouseDown={() => setOpen(false)}>
          <div
            className="sb-modal"
            style={{ maxWidth: 640, maxHeight: "85vh", overflowY: "auto" }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="sb-modal__header">
              <h2>Règles du jeu 🏆</h2>
              <button className="sb-x" onClick={() => setOpen(false)}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
              {rules.map((r, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 14,
                    alignItems: "flex-start",
                    background: "#f8fafc",
                    borderRadius: 12,
                    padding: "12px 14px",
                  }}
                >
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{r.emoji}</span>
                  <div>
                    <div style={{ fontWeight: 800, marginBottom: 2 }}>{r.title}</div>
                    <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.5 }}>{r.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
