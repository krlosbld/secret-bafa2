"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// Règles de base, valables dans toutes les parties. Les règles et pouvoirs optionnels actifs dans la
// session sont chargés à l'ouverture (/api/game/rules) et affichés à la suite.
const rules = [
  {
    emoji: "✍️",
    title: "Propose ton secret",
    text: "Une fois inscrit au jeu, propose un secret sur toi avec le bouton « Proposer mon secret » (un seul par personne), dans les 24 h qui suivent ton inscription. Tu lui attribues de 1 à 5 points bonus : plus il est difficile à deviner, plus tu en mets.",
  },
  {
    emoji: "✅",
    title: "Validation par le maître du jeu",
    text: "Le maître du jeu valide les secrets. Ils apparaissent sans nom d'auteur quand la partie commence.",
  },
  {
    emoji: "🔥",
    title: "Buzze !",
    text: "Tu penses reconnaître l'auteur d'un secret ? Clique sur BUZZ 🔥 et choisis son prénom dans la liste. Buzz possibles de 9 h à 18 h, dans la limite de ton quota du jour (remis à zéro chaque nuit). Tu ne peux pas buzzer ton propre secret.",
  },
  {
    emoji: "🎭",
    title: "Faux secrets",
    text: "Certains secrets sont peut-être faux, inventés par le maître du jeu. Si tu en repères un, buzze « C'est un faux secret » : la réponse est immédiate, et tu gagnes ses points si tu as vu juste.",
  },
  {
    emoji: "🏅",
    title: "Validation des buzz",
    text: "Le maître du jeu valide les buzz. Si tu as trouvé le bon auteur, tu gagnes 2 points + les points bonus du secret. Si plusieurs personnes ont trouvé, c'est la première qui gagne.",
  },
  {
    emoji: "🌙",
    title: "Secret non trouvé",
    text: "Chaque nuit, si ton secret n'a pas encore été trouvé, tu gagnes 1 point. À la fin de la partie, un secret jamais trouvé rapporte à son auteur ses points bonus + 10.",
  },
  {
    emoji: "🏆",
    title: "Vainqueur",
    text: "Le participant avec le plus de points à la fin de la partie remporte le jeu !",
  },
];

type ActiveRule = { key: string; section: string; title: string; text: string };

export default function RulesModal() {
  // Règles du Secret BAFA : seulement dans l'onglet Jeu (secrets, classement, gestion).
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<ActiveRule[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetch("/api/game/rules", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => alive && setActive(d.rules ?? []))
      .catch(() => alive && setActive([]));
    return () => {
      alive = false;
    };
  }, [open]);

  if (!pathname.startsWith("/jeu") && !pathname.startsWith("/ranking")) return null;

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

            {active && active.length > 0 && (
              <>
                <h3 style={{ fontSize: 15, margin: "20px 0 10px", color: "#0f766e" }}>Dans cette partie</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {active.map((r) => (
                    <div key={r.key} style={{ background: r.section === "pouvoirs" ? "#faf5ff" : "#f0fdfa", borderRadius: 12, padding: "12px 14px" }}>
                      <div style={{ fontWeight: 800, marginBottom: 2 }}>{r.title}</div>
                      <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.5 }}>{r.text}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
