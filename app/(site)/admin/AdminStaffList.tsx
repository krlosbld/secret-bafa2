"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type StaffMember = {
  id: string;
  firstName: string;
  role: string;
  username: string | null;
  isGameMaster: boolean;
};

const ROLE_LABELS: Record<string, string> = {
  FORMATEUR: "Formateur",
  DIRECTEUR: "Directeur",
};

// mode "team" : fiches d'équipe (suppression), sans rien du jeu. mode "gameMaster" : uniquement la
// bascule « maître de jeu » des formateurs (page Gestion du jeu).
export default function AdminStaffList({ staff, mode = "team" }: { staff: StaffMember[]; mode?: "team" | "gameMaster" }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function del(id: string, name: string) {
    if (!confirm(`Supprimer le compte de ${name} ?`)) return;
    setLoading(id);
    await fetch(`/api/admin/players/${id}`, { method: "DELETE" });
    router.refresh();
    setLoading(null);
  }

  async function toggleGameMaster(id: string, current: boolean) {
    setLoading(id);
    await fetch(`/api/admin/players/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isGameMaster: !current }),
    });
    router.refresh();
    setLoading(null);
  }

  if (staff.length === 0) {
    return <p style={{ color: "#64748b", fontSize: 14 }}>{mode === "gameMaster" ? "Aucun formateur dans cette session." : "Aucun formateur ni directeur pour cette formation."}</p>;
  }

  return (
    <div className="cards">
      {staff.map((s) => (
        <div className="card admin-card" key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <span style={{ fontWeight: 800 }}>{s.firstName}</span>
            <span
              style={{
                marginLeft: 10,
                fontSize: 12,
                fontWeight: 800,
                color: "#0f766e",
                background: "#ccfbf1",
                padding: "2px 8px",
                borderRadius: 999,
              }}
            >
              {ROLE_LABELS[s.role] ?? s.role}
            </span>
            {s.isGameMaster && (
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#6b21a8",
                  background: "#f3e8ff",
                  padding: "2px 8px",
                  borderRadius: 999,
                }}
              >
                🎭 Maître du jeu
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {mode === "gameMaster" && s.role === "FORMATEUR" && (
              <button
                className="btn btn-ghost"
                disabled={loading === s.id}
                onClick={() => toggleGameMaster(s.id, s.isGameMaster)}
              >
                {s.isGameMaster ? "🎭 Retirer" : "🎭 Nommer maître de jeu"}
              </button>
            )}
            {mode === "team" && (
              <button className="btn btn-danger" disabled={loading === s.id} onClick={() => del(s.id, s.firstName)}>
                Supprimer
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
