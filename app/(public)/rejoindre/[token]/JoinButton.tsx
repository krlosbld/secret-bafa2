"use client";

import { useState } from "react";
import { Alert, postJson } from "../../_components/ui";

export default function JoinButton({ token }: { token: string }) {
  const [legacyCode, setLegacyCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setLoading(true);
    setError(null);
    const r = await postJson(`/api/invite/${encodeURIComponent(token)}/join`, { legacyCode });
    if (!r.ok) {
      setLoading(false);
      setError(String(r.data.error ?? "Impossible de rejoindre la session."));
      return;
    }
    window.location.assign(String(r.data.next ?? "/sessions"));
  }

  return (
    <>
      <LegacyCodeField value={legacyCode} onChange={setLegacyCode} disabled={loading} />
      {error && <Alert kind="error">{error}</Alert>}
      <button type="button" className="bp-btn bp-btn--primary bp-btn--block bp-btn--lg" onClick={join} disabled={loading}>
        {loading ? "Rattachement…" : "Rejoindre la session"}
      </button>
    </>
  );
}

// Ancien code personnel (avant les comptes), facultatif : sert une seule fois à retrouver sa fiche.
export function LegacyCodeField({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <label className="bp-field">
      <span className="bp-field__label">
        Ancien code personnel <span style={{ fontWeight: 400, color: "var(--bp-muted)" }}>(facultatif)</span>
      </span>
      <input
        className="bp-input"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        inputMode="numeric"
        placeholder="ex : 4823"
        disabled={disabled}
        style={{ letterSpacing: 3 }}
      />
      <span className="bp-field__hint">Seulement si vous aviez déjà un code à 4 chiffres dans cette session : votre historique sera récupéré.</span>
    </label>
  );
}
