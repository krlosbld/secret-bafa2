"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Ouvrir / fermer le jeu aux stagiaires de la session (fermé par défaut : onglet Jeu caché).
export default function AdminTraineeGameAccess({ initialOpen }: { initialOpen: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = !open;
    if (!confirm(next ? "Ouvrir le jeu aux stagiaires ? L'onglet Jeu apparaîtra pour eux." : "Fermer le jeu aux stagiaires ? L'onglet Jeu disparaîtra pour eux.")) return;
    setSaving(true);
    const res = await fetch("/api/admin/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameOpenToTrainees: next }),
    }).catch(() => null);
    setSaving(false);
    if (res?.ok) {
      setOpen(next);
      router.refresh();
    } else {
      alert("Impossible d'enregistrer.");
    }
  }

  return (
    <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontWeight: 800 }}>{open ? "🟢 Le jeu est ouvert aux stagiaires" : "⚪ Le jeu est fermé aux stagiaires"}</div>
        <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748b" }}>
          {open
            ? "Ils voient l'onglet Jeu : ils peuvent écrire leur secret, buzzer et voir le classement."
            : "L'onglet Jeu leur est caché. L'équipe peut préparer le jeu (règles, leurres) avant de l'ouvrir."}
        </p>
      </div>
      <button className={`btn ${open ? "btn-ghost" : "btn-main"}`} onClick={toggle} disabled={saving}>
        {saving ? "…" : open ? "Fermer le jeu aux stagiaires" : "🚀 Ouvrir le jeu aux stagiaires"}
      </button>
    </div>
  );
}
