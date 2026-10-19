"use client";

import { useCallback, useEffect, useState } from "react";

// Défis du maître du jeu : une petite enveloppe ✉️ (en-tête de Gestion du jeu) ouvre une fenêtre pour
// rédiger un message, l'envoyer à tous les joueurs ou à certains (date limite optionnelle), puis suivre
// qui a accepté ou refusé. Chaque joueur le voit à sa connexion et reçoit un
// email « Tu as reçu un message du maître du jeu » (sans le texte du défi).
type Player = { id: string; firstName: string; hasEmail: boolean };
type Recipient = { id: string; firstName: string; status: string; respondedAt: string | null; mailStatus: string | null };
type Challenge = { id: string; text: string; deadline: string | null; createdBy: string; createdAt: string; cancelledAt: string | null; recipients: Recipient[] };

const MAX = 1000;
const when = (iso: string) => new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  PENDING: { label: "En attente", bg: "#f1f5f9", fg: "#475569" },
  ACCEPTED: { label: "Accepté", bg: "#dcfce7", fg: "#166534" },
  REFUSED: { label: "Refusé", bg: "#fee2e2", fg: "#991b1b" },
  EXPIRED: { label: "Expiré", bg: "#fef3c7", fg: "#92400e" },
  CLOSED: { label: "Partie terminée", bg: "#f1f5f9", fg: "#64748b" },
  CANCELLED: { label: "Annulé", bg: "#f1f5f9", fg: "#64748b" },
};
const MAIL: Record<string, string> = { SENT: "✉️ mail envoyé", NO_EMAIL: "pas d'adresse mail", FAILED: "⚠️ mail non envoyé" };

export default function AdminChallenges() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ players: Player[]; challenges: Challenge[] } | null>(null);
  const [text, setText] = useState("");
  const [toAll, setToAll] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/challenges", { cache: "no-store" }).catch(() => null);
    const d = res?.ok ? await res.json().catch(() => null) : null;
    if (d?.ok) setData({ players: d.players, challenges: d.challenges });
  }, []);

  useEffect(() => {
    if (!open) return;
    const first = setTimeout(load, 0);
    const id = setInterval(load, 15000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load, open]);

  async function send() {
    setBusy(true);
    setError("");
    setInfo("");
    const res = await fetch("/api/admin/challenges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, playerIds: toAll ? "ALL" : selected, deadline: deadline ? new Date(deadline).toISOString() : null }),
    }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) setError(d.error || "Envoi impossible.");
    else {
      setText("");
      setSelected([]);
      setDeadline("");
      setInfo("Défi envoyé. Les joueurs le verront à leur connexion ; les mails partent dans la foulée.");
    }
    void load();
  }

  async function cancel(id: string) {
    if (!confirm("Annuler ce défi ? Les joueurs qui n'ont pas encore répondu ne le verront plus.")) return;
    const res = await fetch(`/api/admin/challenges/${id}`, { method: "DELETE" }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) setError(d.error || "Annulation impossible.");
    void load();
  }

  const envelope = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      title="Envoyer un défi aux joueurs"
      aria-label="Envoyer un défi aux joueurs"
      style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 10, padding: "4px 10px", fontSize: 20, lineHeight: 1, cursor: "pointer" }}
    >
      ✉️
    </button>
  );
  if (!open) return envelope;

  function close() {
    setOpen(false);
    setError("");
    setInfo("");
  }

  const noEmail = data ? data.players.filter((p) => !p.hasEmail && (toAll || selected.includes(p.id))) : [];

  return (
    <>
      {envelope}
      <div className="sb-backdrop" data-modal="gm-challenge">
        <div className="sb-modal" role="dialog" aria-label="Défis aux joueurs" style={{ maxWidth: 640, maxHeight: "88vh", overflowY: "auto" }}>
          <div className="sb-modal__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <h2>✉️ Défis aux joueurs</h2>
            <button type="button" className="btn btn-ghost" onClick={close} aria-label="Fermer">
              ✕
            </button>
          </div>
          {!data ? (
            <p style={{ color: "#64748b", fontSize: 14 }}>Chargement…</p>
          ) : (
            <div>
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 10px" }}>
                  Rédige un défi : chaque destinataire le verra dans une fenêtre à sa connexion et pourra l&apos;accepter ou le refuser. Il reçoit aussi
                  un mail « Tu as reçu un message du maître du jeu » (le texte du défi n&apos;y figure pas).
                </p>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, MAX))}
                  rows={4}
                  placeholder="Ex. : Chante le refrain de ta chanson préférée au repas de midi."
                  style={{ width: "100%", boxSizing: "border-box", padding: 10, borderRadius: 10, border: "1px solid #cbd5e1", font: "inherit" }}
                />
                <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "right" }}>
                  {text.length}/{MAX}
                </div>

                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "8px 0", fontSize: 14 }}>
                  <label>
                    <input type="radio" checked={toAll} onChange={() => setToAll(true)} /> Tous les joueurs ({data.players.length})
                  </label>
                  <label>
                    <input type="radio" checked={!toAll} onChange={() => setToAll(false)} /> Certains joueurs
                  </label>
                </div>
                {!toAll && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "0 0 8px" }}>
                    {data.players.map((p) => {
                      const on = selected.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelected((s) => (on ? s.filter((x) => x !== p.id) : [...s, p.id]))}
                          style={{
                            borderRadius: 999,
                            padding: "4px 12px",
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: "pointer",
                            border: on ? "2px solid #0f766e" : "1px solid #cbd5e1",
                            background: on ? "#ccfbf1" : "#fff",
                            color: "#0f172a",
                          }}
                        >
                          {on ? "✓ " : ""}
                          {p.firstName}
                        </button>
                      );
                    })}
                    {data.players.length === 0 && <span style={{ color: "#64748b", fontSize: 13 }}>Aucun joueur pour l&apos;instant.</span>}
                  </div>
                )}

                <label style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 14, margin: "8px 0" }}>
                  Date limite (facultative) :
                  <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} style={{ padding: 6, borderRadius: 8, border: "1px solid #cbd5e1", font: "inherit" }} />
                  {deadline && (
                    <button type="button" className="btn btn-ghost" onClick={() => setDeadline("")} style={{ fontSize: 12 }}>
                      Retirer
                    </button>
                  )}
                </label>

                {noEmail.length > 0 && (
                  <p style={{ fontSize: 12, color: "#92400e", margin: "4px 0" }}>
                    Sans adresse mail (fenêtre à la connexion seulement) : {noEmail.map((p) => p.firstName).join(", ")}.
                  </p>
                )}
                {error && <p style={{ color: "#dc2626", fontWeight: 600, fontSize: 13 }}>{error}</p>}
                {info && <p style={{ color: "#166534", fontWeight: 600, fontSize: 13 }}>{info}</p>}
                <button className="btn btn-main" onClick={send} disabled={busy || !text.trim() || (!toAll && selected.length === 0)}>
                  {busy ? "Envoi…" : "🎯 Envoyer le défi"}
                </button>
              </div>

              <h3 style={{ fontSize: 15, fontWeight: 800, margin: "8px 0 10px", color: "#0f172a" }}>Défis envoyés</h3>
              {data.challenges.length === 0 ? (
                <p style={{ color: "#64748b", fontSize: 14 }}>Aucun défi envoyé.</p>
              ) : (
                <div className="cards">
                  {data.challenges.map((c) => {
                    const count = (s: string) => c.recipients.filter((r) => r.status === s).length;
                    return (
                      <div key={c.id} className="card" style={{ borderLeftColor: c.cancelledAt ? "#94a3b8" : "#0f766e" }}>
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          {when(c.createdAt)} · {c.createdBy}
                          {c.deadline && ` · avant le ${when(c.deadline)}`}
                          {c.cancelledAt && " · annulé"}
                        </div>
                        <div style={{ whiteSpace: "pre-wrap", margin: "6px 0 8px", lineHeight: 1.5 }}>{c.text}</div>
                        <div style={{ fontSize: 13, color: "#475569", marginBottom: 6 }}>
                          {count("ACCEPTED")} accepté(s) · {count("REFUSED")} refusé(s) · {count("PENDING")} en attente
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {c.recipients.map((r) => (
                            <span
                              key={r.id}
                              title={[r.respondedAt ? `Réponse le ${when(r.respondedAt)}` : "", r.mailStatus ? MAIL[r.mailStatus] : "mail en cours d'envoi"].filter(Boolean).join(" · ")}
                              style={{ fontSize: 12, fontWeight: 700, borderRadius: 999, padding: "2px 10px", background: STATUS[r.status]?.bg, color: STATUS[r.status]?.fg }}
                            >
                              {r.firstName} · {STATUS[r.status]?.label ?? r.status}
                              {r.mailStatus === "FAILED" && " ⚠️"}
                            </span>
                          ))}
                        </div>
                        {!c.cancelledAt && count("PENDING") > 0 && (
                          <button className="btn btn-ghost" onClick={() => cancel(c.id)} style={{ marginTop: 10, fontSize: 13 }}>
                            Annuler le défi
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
