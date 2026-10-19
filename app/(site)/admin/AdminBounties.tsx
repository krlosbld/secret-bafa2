"use client";

import { useEffect, useState } from "react";

// Secrets mis à prix de la session (maître du jeu uniquement) : propriétaire, mise, période, état,
// issue de la mise et versements des adversaires qui se sont trompés.
type Bounty = {
  id: string;
  kind: string;
  status: string;
  cost: number;
  startsAt: string;
  endsAt: string;
  endedAt: string | null;
  endReason: string | null;
  stakeOutcome: string | null;
  stakeWinner: string | null;
  player: { firstName: string };
  hits: { from: string; amount: number; at: string }[];
};

const when = (iso: string) => new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const STATUS: Record<string, { label: string; tone: string }> = {
  ACTIVE: { label: "En cours", tone: "#b91c1c" },
  AWAITING: { label: "24 h écoulées — bonne réponse en attente de validation", tone: "#b45309" },
  EXPIRED: { label: "Terminée (24 h)", tone: "#64748b" },
  ENDED: { label: "Terminée", tone: "#64748b" },
};

export default function AdminBounties() {
  const [rows, setRows] = useState<Bounty[] | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/admin/powers", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => alive && d.ok && setRows(d.powers.filter((p: Bounty) => p.kind === "BOUNTY")))
        .catch(() => {});
    void load();
    const id = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!rows) return <p style={{ color: "#64748b", fontSize: 14 }}>Chargement…</p>;
  return (
    <div>
      <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 10px" }}>
        Les versements ont lieu quand un buzz faux sur le prénom du propriétaire devient définitif (rejeté ou clos). La mise est rendue
        après 24 h, sauf si une bonne réponse envoyée pendant la mise attend ta validation. Visible par toi seul.
      </p>
      {rows.length === 0 ? (
        <p style={{ color: "#64748b", fontSize: 14 }}>Aucun secret mis à prix pour l&apos;instant.</p>
      ) : (
        <div className="cards">
          {rows.map((b) => (
            <div key={b.id} className="card" style={{ borderLeftColor: "#b91c1c" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <strong>
                  {b.player.firstName} · mise de {b.cost} point{b.cost > 1 ? "s" : ""}
                </strong>
                <span style={{ fontSize: 13, fontWeight: 700, color: STATUS[b.status]?.tone ?? "#475569" }}>{STATUS[b.status]?.label ?? b.status}</span>
              </div>
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
                Du {when(b.startsAt)} au {when(b.endsAt)}
              </div>
              {b.stakeOutcome && (
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  {b.stakeOutcome === "WON" ? `Mise gagnée par ${b.stakeWinner}` : "Mise rendue"}
                  {b.endReason && <span style={{ color: "#64748b" }}> · {b.endReason}</span>}
                </div>
              )}
              <div style={{ fontSize: 13, marginTop: 6 }}>
                {b.hits.length === 0
                  ? "Aucun versement pour l'instant."
                  : `${b.hits.length} versement${b.hits.length > 1 ? "s" : ""} (${b.hits.reduce((a, h) => a + h.amount, 0)} pts) : ${b.hits
                      .map((h) => `${h.from} ${h.amount} pt${h.amount > 1 ? "s" : ""}`)
                      .join(", ")}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
