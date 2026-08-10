"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type StaffMember = {
  id: string;
  firstName: string;
  role: string;
  username: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  FORMATEUR: "Formateur",
  DIRECTEUR: "Directeur",
};

export default function AdminStaffList({ staff }: { staff: StaffMember[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function del(id: string, name: string) {
    if (!confirm(`Supprimer le compte de ${name} ?`)) return;
    setLoading(id);
    await fetch(`/api/admin/players/${id}`, { method: "DELETE" });
    router.refresh();
    setLoading(null);
  }

  if (staff.length === 0) {
    return <p style={{ color: "#64748b", fontSize: 14 }}>Aucun formateur ni directeur pour cette formation.</p>;
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
            <span style={{ color: "#64748b", fontSize: 13, marginLeft: 10 }}>
              {s.username ? `identifiant : ${s.username}` : "connexion par code"}
            </span>
          </div>
          <button className="btn btn-danger" disabled={loading === s.id} onClick={() => del(s.id, s.firstName)}>
            Supprimer
          </button>
        </div>
      ))}
    </div>
  );
}
