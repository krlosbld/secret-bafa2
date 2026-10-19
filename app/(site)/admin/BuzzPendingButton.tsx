"use client";

import { useState } from "react";

// « Buzz à valider (n) » : un bouton qui ouvre la liste des buzz en attente dans une fenêtre, au lieu
// d'une section toujours dépliée dans Gestion du jeu. La fenêtre reste ouverte pendant les décisions
// (la page se rafraîchit derrière, le compteur suit).
export default function BuzzPendingButton({ count, children }: { count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={count > 0 ? "btn btn-main" : "btn btn-ghost"} onClick={() => setOpen(true)}>
        🔔 Buzz à valider ({count})
      </button>
      {open && (
        <div className="sb-backdrop" data-modal="buzz-pending">
          <div className="sb-modal" role="dialog" aria-label="Buzz à valider" style={{ maxWidth: 760, maxHeight: "88vh", overflowY: "auto" }}>
            <div className="sb-modal__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <h2>🔔 Buzz à valider ({count})</h2>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} aria-label="Fermer">
                ✕
              </button>
            </div>
            {children}
          </div>
        </div>
      )}
    </>
  );
}
