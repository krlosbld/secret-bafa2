"use client";

import { useCallback, useEffect, useState } from "react";

// Questions des joueurs (Buzz mystère) — maître du jeu : répondre « Oui » / « Non », ou refuser avec un
// motif si la question vise l'auteur (le joueur reformule, son droit n'est pas consommé).
type Q = {
  id: string;
  source: string;
  text: string;
  status: string;
  answer: string | null;
  refusalReason: string | null;
  answeredBy: string | null;
  createdAt: string;
  answeredAt: string | null;
  player: { firstName: string };
  secret: { content: string; isDecoy: boolean; player: { firstName: string } };
};

const when = (iso: string) => new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function AdminQuestions() {
  const [data, setData] = useState<{ pending: Q[]; done: Q[] } | null>(null);
  const [refusing, setRefusing] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/questions", { cache: "no-store" }).catch(() => null);
    const d = res?.ok ? await res.json().catch(() => null) : null;
    if (d?.ok) setData({ pending: d.pending, done: d.done });
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const id = setInterval(load, 15000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load]);

  async function act(id: string, action: "OUI" | "NON" | "REFUSER") {
    setBusy(id);
    setError("");
    const res = await fetch(`/api/admin/questions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    setBusy(null);
    if (!res?.ok) setError(d.error || "Action impossible.");
    else {
      setRefusing(null);
      setReason("");
    }
    void load();
  }

  if (!data) return <p style={{ color: "#64748b", fontSize: 14 }}>Chargement…</p>;

  return (
    <div>
      <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 10px" }}>
        Réponds seulement « Oui » ou « Non ». Refuse (avec un motif) toute question qui vise directement ou indirectement l&apos;auteur :
        prénom, groupe, rôle, genre, âge… Le joueur pourra la reformuler. Question et réponse restent entre toi et lui.
      </p>
      {error && <p style={{ color: "#dc2626", fontWeight: 600, fontSize: 13 }}>{error}</p>}
      {data.pending.length === 0 ? (
        <p style={{ color: "#64748b", fontSize: 14 }}>Aucune question en attente.</p>
      ) : (
        <div className="cards">
          {data.pending.map((q) => (
            <div key={q.id} className="card" style={{ borderLeftColor: "#7c3aed" }}>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                {when(q.createdAt)} · <strong style={{ color: "#0f172a" }}>{q.player.firstName}</strong> ·{" "}
                {q.source === "LEADER" ? "👑 Privilège du leader" : "❓ Buzz mystère"}
              </div>
              <div style={{ fontSize: 13, color: "#475569", margin: "6px 0 2px" }}>
                Secret : « {q.secret.content} » <span style={{ color: "#94a3b8" }}>({q.secret.isDecoy ? "🎭 faux secret" : `auteur : ${q.secret.player.firstName}`})</span>
              </div>
              <div style={{ fontWeight: 800, fontSize: 15, margin: "4px 0 10px" }}>{q.text}</div>
              {refusing === q.id ? (
                <div>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    maxLength={300}
                    placeholder="Motif transmis au joueur (ex. : la question porte sur l'auteur)"
                    style={{ width: "100%", border: "1px solid #ddd", borderRadius: 8, padding: "6px 8px", fontSize: 14, fontFamily: "inherit" }}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    <button className="btn btn-danger" disabled={busy === q.id || !reason.trim()} onClick={() => act(q.id, "REFUSER")}>
                      Refuser la question
                    </button>
                    <button className="btn btn-ghost" onClick={() => (setRefusing(null), setReason(""))}>
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-main" disabled={busy === q.id} onClick={() => act(q.id, "OUI")}>
                    ✅ Oui
                  </button>
                  <button className="btn btn-main" disabled={busy === q.id} onClick={() => act(q.id, "NON")} style={{ background: "#475569" }}>
                    ❌ Non
                  </button>
                  <button className="btn btn-ghost" disabled={busy === q.id} onClick={() => (setRefusing(q.id), setReason(""))}>
                    🚫 Refuser (à reformuler)
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {data.done.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#475569" }}>Questions traitées ({data.done.length})</summary>
          <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "flex", flexDirection: "column", gap: 6 }}>
            {data.done.map((q) => (
              <li key={q.id} style={{ fontSize: 13, borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                <span style={{ color: "#64748b" }}>{q.answeredAt ? when(q.answeredAt) : ""} · </span>
                <strong>{q.player.firstName}</strong> : {q.text}{" "}
                <strong>
                  {q.status === "ANSWERED" ? (q.answer === "OUI" ? "→ Oui" : "→ Non") : q.status === "REFUSED" ? `→ refusée (${q.refusalReason})` : "→ close"}
                </strong>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
