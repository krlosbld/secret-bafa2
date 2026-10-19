"use client";

import { useEffect, useState } from "react";

// Fausses identités de la session (maître du jeu uniquement) : véritable auteur, prénom emprunté,
// période, état. Ces informations ne sont jamais envoyées aux joueurs.
type Power = {
  id: string;
  kind: string;
  status: string;
  cost: number;
  aliasLabel: string | null;
  startsAt: string;
  endsAt: string;
  endedAt: string | null;
  endReason: string | null;
  player: { firstName: string };
};

const when = (iso: string) => new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const STATUS: Record<string, { label: string; tone: string }> = {
  ACTIVE: { label: "Active", tone: "#6b21a8" },
  EXPIRED: { label: "Terminée (24 h)", tone: "#64748b" },
  ENDED: { label: "Terminée", tone: "#64748b" },
};

export default function AdminFakeIdentities() {
  const [data, setData] = useState<{ powers: Power[]; camouflagedBuzzes: number } | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/admin/powers", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => alive && d.ok && setData({ powers: d.powers.filter((p: Power) => p.kind === "FAKE_IDENTITY"), camouflagedBuzzes: d.camouflagedBuzzes }))
        .catch(() => {});
    void load();
    const id = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!data) return <p style={{ color: "#64748b", fontSize: 14 }}>Chargement…</p>;
  return (
    <div>
      <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 10px" }}>
        Pendant un camouflage, sur le secret de son véritable auteur, les buzz proposant son prénom ou le prénom emprunté sont jugés faux.
        Visible par toi seul.
        {data.camouflagedBuzzes > 0 && ` ${data.camouflagedBuzzes} buzz ont été jugés faux par un camouflage.`}
      </p>
      {data.powers.length === 0 ? (
        <p style={{ color: "#64748b", fontSize: 14 }}>Aucune fausse identité achetée pour l&apos;instant.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#64748b" }}>
                <th style={{ padding: "4px 6px" }}>Véritable auteur</th>
                <th style={{ padding: "4px 6px" }}>Prénom emprunté</th>
                <th style={{ padding: "4px 6px" }}>Début</th>
                <th style={{ padding: "4px 6px" }}>Fin</th>
                <th style={{ padding: "4px 6px" }}>État</th>
              </tr>
            </thead>
            <tbody>
              {data.powers.map((p) => (
                <tr key={p.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "5px 6px", fontWeight: 700 }}>{p.player.firstName}</td>
                  <td style={{ padding: "5px 6px" }}>{p.aliasLabel ?? "—"}</td>
                  <td style={{ padding: "5px 6px", whiteSpace: "nowrap" }}>{when(p.startsAt)}</td>
                  <td style={{ padding: "5px 6px", whiteSpace: "nowrap" }}>{when(p.endedAt && p.status === "ENDED" ? p.endedAt : p.endsAt)}</td>
                  <td style={{ padding: "5px 6px", fontWeight: 700, color: STATUS[p.status]?.tone ?? "#475569" }}>
                    {STATUS[p.status]?.label ?? p.status}
                    {p.endReason && p.status === "ENDED" && <span style={{ fontWeight: 400, color: "#64748b" }}> · {p.endReason}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
