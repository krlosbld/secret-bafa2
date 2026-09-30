"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Réglages d'une session : nom, type de formation, date de début (la fin est calculée d'après le
// type), lieu. Même formulaire pour l'admin, le gestionnaire et le directeur de la session.

const TYPES = [
  { value: "BAFA", label: "Formation générale (BAFA)", days: 8 },
  { value: "APPRO", label: "Approfondissement", days: 6 },
];

type Settings = { name: string; sessionType: string; startDate: string | null; location: string };

function endOf(start: string, type: string): string | null {
  if (!start) return null;
  const days = TYPES.find((t) => t.value === type)?.days ?? 8;
  const d = new Date(`${start}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days - 1);
  return d.toLocaleDateString("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default function SessionSettingsForm({ formationId, initial }: { formationId: string; initial: Settings }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [sessionType, setSessionType] = useState(initial.sessionType);
  const [startDate, setStartDate] = useState(initial.startDate ?? "");
  const [location, setLocation] = useState(initial.location);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/sessions/${formationId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, sessionType, startDate: startDate || null, location }),
      });
      const data = await res.json().catch(() => ({}));
      setMessage(res.ok ? { ok: true, text: "Réglages enregistrés ✓" } : { ok: false, text: data.error || "Enregistrement impossible." });
      if (res.ok) router.refresh();
    } catch {
      setMessage({ ok: false, text: "Connexion impossible." });
    }
    setSaving(false);
  }

  const end = endOf(startDate, sessionType);
  const days = TYPES.find((t) => t.value === sessionType)?.days;

  return (
    <form className="card" onSubmit={save} style={{ maxWidth: 640 }}>
      <div className="sb-form">
        <label className="sb-field">
          <span>Nom de la session</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required disabled={saving} />
        </label>

        <label className="sb-field">
          <span>Type de formation</span>
          <select
            value={sessionType}
            onChange={(e) => setSessionType(e.target.value)}
            disabled={saving}
            style={{ width: "100%", border: "1px solid #ddd", borderRadius: 8, padding: "10px 12px", fontSize: "0.9rem", background: "#fff" }}
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label} — {t.days} jours
              </option>
            ))}
          </select>
        </label>

        <label className="sb-field">
          <span>Date de début</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={saving} />
        </label>
        <p style={{ margin: "-4px 0 0", fontSize: 13, color: "#475569" }}>
          {end ? (
            <>
              Fin de la session : <strong>{end}</strong> ({days} jours).
            </>
          ) : (
            "Sans date de début, la session apparaît « Dates à venir »."
          )}
        </p>

        <label className="sb-field">
          <span>
            Lieu <span style={{ fontWeight: 400, color: "#64748b" }}>(facultatif)</span>
          </span>
          <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} placeholder="ex : Dijon" disabled={saving} />
        </label>

        <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
          Le type et la date de début règlent aussi le planning (nombre de jours, dates affichées).
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button className="btn btn-main" type="submit" disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
          {message && <span style={{ fontSize: 14, fontWeight: 700, color: message.ok ? "#15803d" : "#dc2626" }}>{message.text}</span>}
        </div>
      </div>
    </form>
  );
}
