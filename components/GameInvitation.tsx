"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Fenêtre « Le Jeu des secrets a été lancé… ». Elle attend qu'aucune autre fenêtre ne soit ouverte
// (info personnelle, rappels) pour ne pas s'empiler. Un refus demande une confirmation : il est définitif.
export default function GameInvitation() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<"ask" | "confirmDecline">("ask");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      if (!document.querySelector(".sb-backdrop, [data-modal]")) {
        setVisible(true);
        clearInterval(id);
      }
    }, 400);
    return () => clearInterval(id);
  }, []);

  async function answer(choice: "ACCEPTED" | "DECLINED") {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/game/participation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ choice }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok && res?.status !== 409) {
      setBusy(false);
      setError(data.error || "Connexion impossible. Réessaie.");
      return;
    }
    if (choice === "ACCEPTED") {
      // Directement sur le jeu, avec la fenêtre de proposition du secret ouverte.
      window.location.assign("/jeu?proposer=1");
      return;
    }
    setVisible(false);
    router.refresh();
  }

  if (!visible) return null;

  return (
    <div className="sb-backdrop game-invite">
      <div className="sb-modal" role="dialog" aria-modal="true" aria-labelledby="game-invite-title" style={{ maxWidth: 440 }}>
        {step === "ask" ? (
          <>
            <div style={{ fontSize: 44, textAlign: "center", lineHeight: 1 }} aria-hidden>
              🤫
            </div>
            <h2 id="game-invite-title" style={{ textAlign: "center", margin: "12px 0 8px", fontSize: 20 }}>
              Le Jeu des secrets a été lancé par le directeur !
            </h2>
            <p style={{ textAlign: "center", margin: "0 0 20px", color: "#475569", fontSize: 15 }}>Souhaites-tu y participer ?</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button className="sb-btn sb-btn--main" onClick={() => answer("ACCEPTED")} disabled={busy} style={{ padding: "12px 16px", fontSize: 16 }}>
                {busy ? "…" : "Oui, je participe"}
              </button>
              <button className="sb-btn sb-btn--ghost" onClick={() => setStep("confirmDecline")} disabled={busy} style={{ padding: "12px 16px", fontSize: 15 }}>
                Non, merci
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="game-invite-title" style={{ margin: "4px 0 10px", fontSize: 19 }}>
              Tu ne veux pas participer ?
            </h2>
            <p style={{ margin: "0 0 20px", color: "#475569", fontSize: 15, lineHeight: 1.5 }}>
              Ton choix est <strong>définitif pour cette session</strong> : tu ne pourras plus rejoindre le jeu ensuite, et l&apos;onglet Jeu
              restera caché.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button className="sb-btn sb-btn--ghost" onClick={() => answer("DECLINED")} disabled={busy} style={{ padding: "12px 16px", fontSize: 15, color: "#b91c1c" }}>
                {busy ? "…" : "Oui, je confirme mon refus"}
              </button>
              <button className="sb-btn sb-btn--main" onClick={() => setStep("ask")} disabled={busy} style={{ padding: "12px 16px", fontSize: 15 }}>
                Retour
              </button>
            </div>
          </>
        )}
        {error && <p style={{ margin: "12px 0 0", color: "#dc2626", fontWeight: 700, fontSize: 14, textAlign: "center" }}>{error}</p>}
      </div>
    </div>
  );
}
