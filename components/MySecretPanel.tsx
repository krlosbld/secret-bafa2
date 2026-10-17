"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SubmitSecretModal from "@/components/SubmitSecretModal";

// « Mon secret » (onglet Jeu) : où en est sa proposition — en attente, validée, trouvée ou refusée —
// et, si besoin, la fenêtre pour en proposer une (ouverte d'office juste après avoir accepté de jouer).
export type MySecretStatus = "NONE" | "PENDING" | "PUBLISHED" | "FOUND" | "REJECTED";

const TEXT: Record<MySecretStatus, { icon: string; title: string; text: string; tone: string }> = {
  NONE: { icon: "✍️", title: "Propose ton secret", text: "Écris un secret sur toi : le maître du jeu le validera avant qu'il entre dans le jeu.", tone: "#1e3a5f" },
  PENDING: { icon: "⏳", title: "Ton secret est en attente de validation", text: "Le maître du jeu va le lire. Tu seras fixé à ta prochaine visite.", tone: "#b45309" },
  PUBLISHED: { icon: "✅", title: "Ton secret a été validé", text: "Il est en jeu : aux autres de deviner qu'il est à toi !", tone: "#15803d" },
  FOUND: { icon: "🎯", title: "Ton secret a été trouvé", text: "Quelqu'un a deviné qu'il était à toi.", tone: "#15803d" },
  REJECTED: { icon: "❌", title: "Ton précédent secret n'a pas été accepté", text: "Propose un autre secret : il repassera par la validation du maître du jeu.", tone: "#b91c1c" },
};

export default function MySecretPanel({ status, autoOpen }: { status: MySecretStatus; autoOpen: boolean }) {
  const router = useRouter();
  const canPropose = status === "NONE" || status === "REJECTED";
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

  const t = TEXT[status];
  return (
    <div className="card my-secret" style={{ borderLeftColor: t.tone, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span style={{ fontSize: 26, lineHeight: 1 }} aria-hidden>
            {t.icon}
          </span>
          <div>
            <div style={{ fontWeight: 800, color: t.tone }}>{t.title}</div>
            <div style={{ fontSize: 14, color: "#475569", marginTop: 2 }}>{t.text}</div>
          </div>
        </div>
        {canPropose && (
          <button className="btn btn-main" onClick={() => setOpen(true)} style={{ padding: "9px 16px", fontSize: 14 }}>
            {status === "REJECTED" ? "Proposer un autre secret" : "Proposer mon secret"}
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
