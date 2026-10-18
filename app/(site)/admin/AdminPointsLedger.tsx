"use client";

import { useEffect, useState } from "react";

// Journal des points (maître du jeu) : chaque opération sur les scores depuis sa mise en service,
// avec le motif, le solde obtenu et l'auteur d'une intervention manuelle.
type Entry = {
  id: string;
  playerId: string | null;
  playerLabel: string;
  delta: number;
  balanceAfter: number;
  kind: string;
  actorLabel: string | null;
  note: string | null;
  createdAt: string;
};

const KIND_LABEL: Record<string, string> = {
  BUZZ_WIN: "Secret trouvé",
  NIGHTLY: "Point de la nuit",
  END_BONUS: "Bonus de fin de partie",
  HISTORY_REVEAL: "Historique payant",
  MANUAL_SET: "Score corrigé",
  MANUAL_AWARD: "+1 manuel",
  GAME_RESET: "Remise à zéro",
};

export default function AdminPointsLedger({ players }: { players: { id: string; firstName: string }[] }) {
  const [open, setOpen] = useState(false);
  const [playerId, setPlayerId] = useState("");
  const [entries, setEntries] = useState<Entry[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetch(`/api/admin/points-ledger${playerId ? `?playerId=${playerId}` : ""}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => alive && setEntries(d.entries ?? []))
      .catch(() => alive && setEntries([]));
    return () => {
      alive = false;
    };
  }, [open, playerId]);

  if (!open) {
    return (
      <button className="btn btn-ghost" onClick={() => setOpen(true)}>
        📒 Voir le journal des points
      </button>
    );
  }

  return (
    <div className="card">
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <select
          value={playerId}
          onChange={(e) => {
            setEntries(null);
            setPlayerId(e.target.value);
          }} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "6px 8px" }}>
          <option value="">Tous les joueurs</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName}
            </option>
          ))}
        </select>
        <button className="btn btn-ghost" style={{ padding: "5px 10px", fontSize: 13 }} onClick={() => setOpen(false)}>
          Fermer
        </button>
      </div>
      {!entries ? (
        <p style={{ color: "#64748b", fontSize: 14 }}>Chargement…</p>
      ) : entries.length === 0 ? (
        <p style={{ color: "#64748b", fontSize: 14 }}>Aucune opération enregistrée depuis la mise en service du journal.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#64748b" }}>
                <th style={{ padding: "4px 6px" }}>Date</th>
                <th style={{ padding: "4px 6px" }}>Joueur</th>
                <th style={{ padding: "4px 6px" }}>Opération</th>
                <th style={{ padding: "4px 6px", textAlign: "right" }}>Points</th>
                <th style={{ padding: "4px 6px", textAlign: "right" }}>Solde</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "5px 6px", whiteSpace: "nowrap", color: "#64748b" }}>
                    {new Date(e.createdAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td style={{ padding: "5px 6px", fontWeight: 700 }}>{e.playerLabel}</td>
                  <td style={{ padding: "5px 6px" }}>
                    {KIND_LABEL[e.kind] ?? e.kind}
                    {e.note && <span style={{ color: "#64748b" }}> · {e.note}</span>}
                    {e.actorLabel && <span style={{ color: "#94a3b8" }}> · par {e.actorLabel}</span>}
                  </td>
                  <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: 800, color: e.delta > 0 ? "#15803d" : e.delta < 0 ? "#b91c1c" : "#64748b" }}>
                    {e.delta > 0 ? `+${e.delta}` : e.delta}
                  </td>
                  <td style={{ padding: "5px 6px", textAlign: "right" }}>{e.balanceAfter}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
