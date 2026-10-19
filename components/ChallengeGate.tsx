"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { PendingChallenge } from "@/lib/gameChallenges";

// Fenêtre « 🎯 Message du maître du jeu » : à la connexion d'un joueur qui a un défi en attente.
// Accepter ou refuser ; « Plus tard » la masque pour cette visite (elle revient à la prochaine
// connexion tant que le défi attend une réponse et que la date limite n'est pas passée).
const DISMISS_KEY = "bp_challenge_gate_dismissed";

const when = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

function dismissed(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(DISMISS_KEY) || "[]");
  } catch {
    return [];
  }
}

export default function ChallengeGate() {
  const pathname = usePathname();
  const [queue, setQueue] = useState<PendingChallenge[]>([]);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    fetch("/api/game/challenges", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { challenges: [] }))
      .then((d) => {
        const hidden = dismissed();
        const list: PendingChallenge[] = (d.challenges ?? []).filter((c: PendingChallenge) => !hidden.includes(c.id));
        if (!alive || list.length === 0) return;
        setQueue(list);
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

  const current = queue[0];

  function next() {
    setError("");
    setQueue((q) => {
      const rest = q.slice(1);
      if (rest.length === 0) setShow(false);
      return rest;
    });
  }

  function later() {
    try {
      sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...dismissed(), ...queue.map((c) => c.id)]));
    } catch {}
    setShow(false);
    setQueue([]);
  }

  async function answer(accept: boolean) {
    setBusy(true);
    setError("");
    const res = await fetch("/api/game/challenges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: current.id, accept }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (res?.ok || res?.status === 409) next();
    else setError(data.error || "Réponse impossible, réessaie.");
  }

  if (!show || !current) return null;
  return (
    <div className="sb-backdrop" data-modal="challenge">
      <div className="sb-modal" role="dialog" aria-label="Message du maître du jeu" style={{ maxWidth: 520, maxHeight: "85vh", overflowY: "auto" }}>
        <div className="sb-modal__header">
          <h2>🎯 Message du maître du jeu</h2>
        </div>
        <p className="sb-help">Le maître du jeu te lance un défi :</p>
        <div style={{ background: "#f8fafc", borderRadius: 12, padding: "12px 14px", margin: "10px 0", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{current.text}</div>
        {current.deadline && (
          <p className="sb-help" style={{ fontSize: 13 }}>
            ⏳ Réponds avant {when(current.deadline)}.
          </p>
        )}
        {queue.length > 1 && (
          <p className="sb-help" style={{ fontSize: 13 }}>
            Encore {queue.length - 1} autre{queue.length > 2 ? "s" : ""} défi{queue.length > 2 ? "s" : ""} après celui-ci.
          </p>
        )}
        {error && <p style={{ color: "#dc2626", fontWeight: 600, fontSize: 13 }}>{error}</p>}
        <div className="sb-actions">
          <button className="sb-btn sb-btn--ghost" onClick={later} disabled={busy}>
            Plus tard
          </button>
          <button className="sb-btn sb-btn--ghost" onClick={() => answer(false)} disabled={busy}>
            Je refuse
          </button>
          <button className="sb-btn sb-btn--main" onClick={() => answer(true)} disabled={busy}>
            J&apos;accepte
          </button>
        </div>
      </div>
    </div>
  );
}
