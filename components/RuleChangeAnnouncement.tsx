"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { RuleChange } from "@/lib/gameAnnouncements";

// Fenêtre « Du nouveau dans les règles » : montrée une fois à chaque participant après un changement
// de règle par le maître du jeu (activation, retrait, nouveau coût). Attend qu'aucune autre fenêtre ne
// soit ouverte ; « J'ai compris » la marque comme lue.
const BADGE: Record<RuleChange["kind"], { label: string; bg: string; fg: string }> = {
  NOUVELLE: { label: "Nouveau", bg: "#dcfce7", fg: "#166534" },
  MODIFIEE: { label: "Modifié", bg: "#fef3c7", fg: "#92400e" },
  RETIREE: { label: "Retiré", bg: "#f1f5f9", fg: "#475569" },
};

export default function RuleChangeAnnouncement() {
  const pathname = usePathname();
  const [changes, setChanges] = useState<RuleChange[]>([]);
  const [show, setShow] = useState(false);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    fetch("/api/game/announcements", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { changes: [] }))
      .then((d) => {
        if (!alive || !d.changes?.length) return;
        setChanges(d.changes);
        timer = setInterval(() => {
          if (!document.querySelector(".sb-backdrop, [data-modal]")) {
            setShow(true);
            clearInterval(timer);
          }
        }, 400);
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [pathname]);

  async function close() {
    setShow(false);
    setChanges([]);
    await fetch("/api/game/announcements", { method: "POST" }).catch(() => {});
  }

  if (!show || changes.length === 0) return null;
  return (
    <div className="sb-backdrop" data-modal="rules-change">
      <div className="sb-modal" role="dialog" aria-label="Du nouveau dans les règles du jeu" style={{ maxWidth: 520, maxHeight: "85vh", overflowY: "auto" }}>
        <div className="sb-modal__header">
          <h2>📣 Du nouveau dans les règles du jeu</h2>
        </div>
        <p className="sb-help">Le maître du jeu a modifié les règles de la partie :</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "10px 0 16px" }}>
          {changes.map((c, i) => (
            <div key={i} style={{ background: "#f8fafc", borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <strong>{c.title}</strong>
                <span style={{ fontSize: 11, fontWeight: 800, borderRadius: 999, padding: "1px 8px", background: BADGE[c.kind].bg, color: BADGE[c.kind].fg }}>
                  {BADGE[c.kind].label}
                </span>
              </div>
              <div style={{ fontSize: 14, color: "#475569", marginTop: 4, lineHeight: 1.5 }}>{c.text}</div>
            </div>
          ))}
        </div>
        <p className="sb-help" style={{ fontSize: 13 }}>
          Retrouve à tout moment les règles en vigueur avec le bouton « ? » de l&apos;onglet Jeu.
        </p>
        <div className="sb-actions">
          {pathname !== "/jeu" && (
            <Link className="sb-btn sb-btn--ghost" href="/jeu" onClick={close}>
              Aller au jeu
            </Link>
          )}
          <button className="sb-btn sb-btn--main" onClick={close}>
            J&apos;ai compris
          </button>
        </div>
      </div>
    </div>
  );
}
