"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SESSION_TYPES } from "@/lib/planningConfig";

// Réglages d'une session : nom, type de formation, date de début (la fin est calculée d'après le
// type), lieu. Même formulaire pour l'admin, le gestionnaire et le directeur de la session.

const TYPES = Object.entries(SESSION_TYPES).map(([value, t]) => ({ value, label: t.label, days: t.days }));

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
      setMessage(res.ok ? { ok: true, text: "Enregistré ✓" } : { ok: false, text: data.error || "Enregistrement impossible." });
      if (res.ok) router.refresh();
    } catch {
      setMessage({ ok: false, text: "Connexion impossible." });
    }
    setSaving(false);
  }

  const end = endOf(startDate, sessionType);
  const days = TYPES.find((t) => t.value === sessionType)?.days;

  return (
    <form className="set-card" onSubmit={save}>
      <div className="set-card__head">
        <h2 className="set-card__title">Session</h2>
        <p className="set-card__sub">Le type et la date de début règlent aussi le planning.</p>
      </div>

      <label className="set-field">
        <span>Nom de la session</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required disabled={saving} />
      </label>

      <div className="set-row">
        <label className="set-field">
          <span>Type de formation</span>
          <select value={sessionType} onChange={(e) => setSessionType(e.target.value)} disabled={saving}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value} title={t.label}>
                {t.label.split(" — ")[0]} · {t.days} jours
              </option>
            ))}
          </select>
        </label>
        <label className="set-field">
          <span>Date de début</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={saving} />
        </label>
      </div>
      <p className="set-note">
        {end ? (
          <>
            {TYPES.find((t) => t.value === sessionType)?.label} · fin : <strong>{end}</strong> ({days} jours)
          </>
        ) : (
          "Sans date de début, la session apparaît « Dates à venir »."
        )}
      </p>

      <label className="set-field">
        <span>
          Lieu <em>(facultatif)</em>
        </span>
        <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} placeholder="ex : Dijon" disabled={saving} />
      </label>

      <div className="set-actions">
        <button className="btn btn-main" type="submit" disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        {message && <span className={`set-msg${message.ok ? "" : " set-msg--error"}`}>{message.text}</span>}
      </div>
    </form>
  );
}
