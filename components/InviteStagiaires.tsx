"use client";

import { useState } from "react";

// « Ajouter les stagiaires à la session » : affiche le QR code et le lien d'invitation de la session.
// En le scannant, chaque stagiaire crée son compte et est rattaché automatiquement à la session.

type Invite = { url: string; qrSvg: string; qrPng: string; joinCount: number; createdAt: string; stagiaireCount: number };

export default function InviteStagiaires({ formationId, sessionName }: { formationId: string; sessionName: string }) {
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function load(regenerate = false) {
    if (regenerate && !confirm("Générer un nouveau lien ?\n\nL'ancien lien et l'ancien QR code (déjà imprimés ou partagés) ne fonctionneront plus.")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${formationId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error || "Impossible de créer le lien.");
      else setInvite(data);
    } catch {
      setError("Connexion impossible.");
    }
    setLoading(false);
  }

  async function copy() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copie impossible : sélectionnez le lien à la main.");
    }
  }

  if (!invite) {
    return (
      <div style={{ margin: "0 0 18px" }}>
        <button className="btn btn-main" onClick={() => load()} disabled={loading} style={{ fontSize: 14, padding: "9px 16px" }}>
          {loading ? "Préparation…" : "+  Ajouter les stagiaires à la session"}
        </button>
        {error && <p style={{ color: "#dc2626", fontWeight: 700, fontSize: 14 }}>{error}</p>}
      </div>
    );
  }

  const fileName = `qr-${sessionName.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.png`;

  return (
    <div className="card" style={{ margin: "0 0 18px", display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
      <div
        aria-label="QR code d'invitation"
        role="img"
        style={{ width: 200, height: 200, flex: "0 0 auto", background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 6 }}
        dangerouslySetInnerHTML={{ __html: invite.qrSvg }}
      />
      <div style={{ flex: "1 1 260px", minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>Ajouter les stagiaires à « {sessionName} »</div>
        <p style={{ margin: 0, fontSize: 14, color: "#475569", lineHeight: 1.5 }}>
          Les stagiaires scannent ce QR code (ou ouvrent le lien), créent leur compte, et sont <strong>rattachés automatiquement</strong> à la session en
          tant que stagiaires.
        </p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <input
            readOnly
            value={invite.url}
            onFocus={(e) => e.target.select()}
            style={{ flex: "1 1 220px", minWidth: 0, border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
          />
          <button className="btn btn-main" onClick={copy}>
            {copied ? "Copié ✓" : "Copier le lien"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a className="btn btn-ghost" href={invite.qrPng} download={fileName} style={{ textDecoration: "none" }}>
            ⬇️ Télécharger le QR code
          </a>
          <button className="btn btn-ghost" onClick={() => load(true)} disabled={loading}>
            🔄 Nouveau lien
          </button>
          <button className="btn btn-ghost" onClick={() => setInvite(null)}>
            Fermer
          </button>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
          {invite.stagiaireCount} stagiaire(s) inscrit(s) avec un compte · {invite.joinCount} via ce lien
        </p>
        {error && <p style={{ color: "#dc2626", fontWeight: 700, fontSize: 14, margin: 0 }}>{error}</p>}
      </div>
    </div>
  );
}
