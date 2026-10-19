"use client";

import { useEffect, useState } from "react";

// Leaders du jour (maître du jeu) : relevé de 9 h, privilège choisi et utilisation.
type Row = { id: string; day: string; points: number; choice: string | null; chosenAt: string | null; historyUsedAt: string | null; player: { firstName: string } };
const LABEL: Record<string, string> = { EXTRA_BUZZ: "🔥 Un buzz de plus", QUESTION: "❓ Une question (voir « Questions des joueurs »)", HISTORY: "🔍 Historique gratuit" };

export default function AdminLeaders() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/admin/leaders", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => alive && d.ok && setRows(d.leaders))
        .catch(() => {});
    void load();
    const id = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  if (!rows) return <p style={{ color: "#64748b", fontSize: 14 }}>Chargement…</p>;
  const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "2-digit" });
  return (
    <div>
      <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 10px" }}>
        Relevé chaque matin à 9 h : les vrais joueurs en tête (ex æquo compris, au moins 1 point). Le choix se fait avant 18 h.
      </p>
      {rows.length === 0 ? (
        <p style={{ color: "#64748b", fontSize: 14 }}>Aucun leader désigné pour l&apos;instant (premier relevé demain à 9 h si la partie est en cours).</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map((r) => (
            <li key={r.id} style={{ fontSize: 13, borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
              <span style={{ color: "#64748b" }}>{dayLabel(r.day)} · </span>
              <strong>{r.player.firstName}</strong> ({r.points} pt{r.points > 1 ? "s" : ""}) ·{" "}
              {r.choice ? LABEL[r.choice] ?? r.choice : <span style={{ color: "#b45309" }}>pas encore choisi</span>}
              {r.choice === "HISTORY" && (r.historyUsedAt ? " (consulté)" : " (pas encore consulté)")}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
