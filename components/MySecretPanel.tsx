"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SubmitSecretModal from "@/components/SubmitSecretModal";

// « Mon secret » (onglet Jeu, participant) : où en est sa proposition — à envoyer (avec le délai de
// 24 h), en attente, validée, trouvée ou refusée (avec le motif) — et la fenêtre pour proposer,
// ouverte d'office juste après avoir accepté de jouer. CONVERTED : le maître du jeu a transformé son
// secret en faux secret — il en propose un nouveau, même partie commencée (replace).
export type MySecretStatus = "NONE" | "PENDING" | "PUBLISHED" | "FOUND" | "REJECTED" | "CONVERTED";

function timeLeft(deadline: string): string {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "le délai est dépassé";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `il te reste ${h} h ${String(m).padStart(2, "0")}` : `il te reste ${m} min`;
}

export default function MySecretPanel({
  status,
  phase,
  deadline,
  reason,
  replace = false,
  autoOpen,
}: {
  status: MySecretStatus;
  phase: "inscriptions_ouvertes" | "en_cours" | "termine";
  deadline: string | null; // fin des 24 h pour une première proposition
  reason: string | null; // motif du dernier refus
  replace?: boolean; // secret transformé en faux : nouvelle proposition possible pendant la partie
  autoOpen: boolean;
}) {
  const router = useRouter();
  const canPropose =
    (phase === "inscriptions_ouvertes" || (replace && phase === "en_cours")) && (status === "NONE" || status === "REJECTED" || status === "CONVERTED");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!autoOpen || !canPropose) return;
    // Après « Oui, je participe » : la fenêtre s'ouvre dès qu'aucune autre n'est affichée.
    const id = setInterval(() => {
      if (!document.querySelector(".sb-backdrop, [data-modal]")) {
        setOpen(true);
        clearInterval(id);
      }
    }, 300);
    return () => clearInterval(id);
  }, [autoOpen, canPropose]);

  const waitingStart = phase === "inscriptions_ouvertes";
  const t: { icon: string; title: string; text: string; tone: string } = {
    NONE: {
      icon: "✍️",
      title: "Propose ton secret",
      text: `Écris un secret sur toi : le maître du jeu le validera.${deadline ? ` Pour rester dans la partie, envoie-le dans les 24 h suivant ton inscription — ${timeLeft(deadline)}.` : ""}`,
      tone: "#1e3a5f",
    },
    PENDING: { icon: "⏳", title: "Ton secret est en attente de validation", text: "Le maître du jeu va le lire. Tu seras fixé à ta prochaine visite.", tone: "#b45309" },
    PUBLISHED: {
      icon: "✅",
      title: "Ton secret a été validé",
      text: waitingStart ? "Il sera visible (sans ton nom) quand le maître du jeu commencera la partie." : "Il est en jeu : aux autres de deviner qu'il est à toi !",
      tone: "#15803d",
    },
    FOUND: { icon: "🎯", title: "Ton secret a été trouvé", text: "Quelqu'un a deviné qu'il était à toi. Tu gardes tes points !", tone: "#15803d" },
    CONVERTED: {
      icon: "🎭",
      title: "Ton secret a été transformé en faux secret",
      text: "Le maître du jeu en a fait un faux secret : il reste en jeu, mais tu ne peux pas buzzer dessus. Propose un nouveau secret, il passera par sa validation.",
      tone: "#6b21a8",
    },
    REJECTED: {
      icon: "❌",
      title: "Ton précédent secret n'a pas été accepté",
      text: "Propose un autre secret : il repassera par la validation du maître du jeu.",
      tone: "#b91c1c",
    },
  }[status];

  return (
    <div className="card my-secret" style={{ borderLeftColor: t.tone, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span style={{ fontSize: 26, lineHeight: 1 }} aria-hidden>
            {t.icon}
          </span>
          <div>
            <div style={{ fontWeight: 800, color: t.tone }}>{t.title}</div>
            {status === "REJECTED" && reason && (
              <div style={{ fontSize: 14, color: "#7f1d1d", marginTop: 4, background: "#fef2f2", borderRadius: 8, padding: "6px 10px" }}>
                <strong>Motif :</strong> {reason}
              </div>
            )}
            {/* Délai restant calculé à l'heure de chacun (serveur, navigateur) : écart de minute toléré. */}
            <div style={{ fontSize: 14, color: "#475569", marginTop: 4 }} suppressHydrationWarning>
              {t.text}
            </div>
          </div>
        </div>
        {canPropose && (
          <button className="btn btn-main" onClick={() => setOpen(true)} style={{ padding: "9px 16px", fontSize: 14 }}>
            {status === "NONE" ? "Proposer mon secret" : "Proposer un autre secret"}
          </button>
        )}
      </div>
      <SubmitSecretModal
        open={open}
        onClose={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
