"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { LeaderState } from "@/lib/leaderPrivilege";

// Fenêtre « 👑 Tu es en tête du classement ! » : à la connexion du leader du jour, tant qu'il n'a pas
// choisi son privilège (avant 18 h). « Plus tard » la masque jusqu'au lendemain sur cet appareil ;
// le choix reste possible dans « Mes pouvoirs ».
export const LEADER_OPTIONS = [
  { choice: "EXTRA_BUZZ", icon: "🔥", title: "Un buzz de plus", text: "Un buzz supplémentaire aujourd'hui, en plus de ton quota." },
  { choice: "QUESTION", icon: "❓", title: "Une question au maître du jeu", text: "Une question fermée sur un secret : il répondra Oui ou Non (jamais sur l'auteur)." },
  { choice: "HISTORY", icon: "🔍", title: "L'historique d'un secret", text: "Les prénoms déjà proposés à tort sur un secret, gratuitement, une fois." },
] as const;

const DISMISS_KEY = "bp_leader_gate_dismissed";

export default function LeaderPrivilegeGate() {
  const pathname = usePathname();
  const [state, setState] = useState<LeaderState | null>(null);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    fetch("/api/game/powers/leader", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { leader: null }))
      .then((d) => {
        const l: LeaderState | null = d.leader;
        if (!alive || !l?.today?.canChoose) return;
        try {
          if (localStorage.getItem(DISMISS_KEY) === l.today.id) return;
        } catch {}
        setState(l);
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

  async function choose(choice: string) {
    setBusy(true);
    setError("");
    const res = await fetch("/api/game/powers/leader", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ choice }) }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) {
      setError(data.error || "Choix impossible.");
      return;
    }
    setDone(choice);
  }

  function later() {
    try {
      if (state?.today) localStorage.setItem(DISMISS_KEY, state.today.id);
    } catch {}
    setShow(false);
  }

  if (!show || !state?.today) return null;
  return (
    <div className="sb-backdrop" data-modal="leader-gate">
      <div className="sb-modal" role="dialog" aria-label="Privilège du leader" style={{ maxWidth: 520 }}>
        <div className="sb-modal__header">
          <h2>👑 Tu es en tête du classement !</h2>
        </div>
        {done ? (
          <>
            <p className="sb-help">
              {done === "EXTRA_BUZZ"
                ? "C'est noté : tu as un buzz de plus aujourd'hui."
                : done === "QUESTION"
                  ? "C'est noté : pose ta question avant 18 h dans « Mes pouvoirs » (onglet Jeu)."
                  : "C'est noté : choisis le secret à consulter avant 18 h dans « Mes pouvoirs » (onglet Jeu)."}
            </p>
            <div className="sb-actions">
              {done !== "EXTRA_BUZZ" && pathname !== "/jeu" && (
                <Link className="sb-btn sb-btn--ghost" href="/jeu" onClick={() => setShow(false)}>
                  Aller au jeu
                </Link>
              )}
              <button className="sb-btn sb-btn--main" onClick={() => setShow(false)}>
                Fermer
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="sb-help">
              Avec {state.today.points} point{state.today.points > 1 ? "s" : ""} au relevé de 9 h
              {state.coLeaders > 1 ? ` (ex æquo avec ${state.coLeaders - 1} autre${state.coLeaders > 2 ? "s" : ""})` : ""}, choisis ton privilège
              du jour — un seul, avant 18 h :
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "12px 0" }}>
              {LEADER_OPTIONS.map((o) => (
                <button
                  key={o.choice}
                  type="button"
                  disabled={busy}
                  onClick={() => choose(o.choice)}
                  style={{ textAlign: "left", border: "2px solid #fde68a", background: "#fffbeb", borderRadius: 12, padding: "10px 12px", cursor: "pointer" }}
                >
                  <div style={{ fontWeight: 800 }}>
                    {o.icon} {o.title}
                  </div>
                  <div style={{ fontSize: 13, color: "#475569" }}>{o.text}</div>
                </button>
              ))}
            </div>
            {error && <p style={{ color: "#dc2626", fontWeight: 600, fontSize: 13 }}>{error}</p>}
            <div className="sb-actions">
              <button className="sb-btn sb-btn--ghost" onClick={later} disabled={busy}>
                Plus tard
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
