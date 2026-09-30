"use client";

import { useState } from "react";

export function PasswordInput({
  label,
  value,
  onChange,
  autoComplete,
  hint,
  disabled,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  hint?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="bp-field">
      <span className="bp-field__label">{label}</span>
      <div className="bp-password">
        <input
          className="bp-input"
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          disabled={disabled}
          autoFocus={autoFocus}
          required
          maxLength={200}
        />
        <button
          type="button"
          className="bp-password__toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        >
          {visible ? "Masquer" : "Afficher"}
        </button>
      </div>
      {hint && <span className="bp-field__hint">{hint}</span>}
    </label>
  );
}

export function Alert({ kind, children }: { kind: "error" | "ok" | "info"; children: React.ReactNode }) {
  return (
    <div className={`bp-alert bp-alert--${kind}`} role={kind === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

// Appel JSON vers /api/auth/* — renvoie { ok, data } sans jamais lever d'exception réseau.
export async function postJson(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Connexion impossible. Vérifiez votre réseau et réessayez." } };
  }
}

export function ResendVerification({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setState("sending");
    setError(null);
    const r = await postJson("/api/auth/resend-verification", { email });
    if (r.ok) {
      setState("sent");
    } else {
      setState("idle");
      setError(String(r.data.error ?? "L'email n'a pas pu être renvoyé."));
    }
  }

  return (
    <div className="bp-stack">
      {state === "sent" && <Alert kind="ok">Un nouvel email de confirmation vient d&apos;être envoyé. Pensez à regarder dans vos spams.</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
      <button type="button" className="bp-btn bp-btn--outline bp-btn--block" onClick={resend} disabled={state === "sending"}>
        {state === "sending" ? "Envoi…" : "Renvoyer l'email de confirmation"}
      </button>
    </div>
  );
}
