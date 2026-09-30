"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, postJson } from "../_components/ui";

export default function ForgotForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const r = await postJson("/api/auth/forgot-password", { email });
    setLoading(false);
    if (!r.ok) {
      setError(String(r.data.error ?? "La demande n'a pas pu être envoyée."));
      return;
    }
    setSentTo(email.trim());
  }

  if (sentTo) {
    return (
      <div className="bp-auth">
        <div className="bp-card bp-status">
          <div className="bp-status__icon" aria-hidden>
            ✉️
          </div>
          <h1 className="bp-status__title">Vérifiez votre boîte mail</h1>
          <p className="bp-status__text">
            Si un compte BafaPilot existe pour <strong>{sentTo}</strong>, un lien pour choisir un nouveau mot de passe vient d&apos;y être envoyé. Il est
            valable 1 heure.
          </p>
          <Link href="/login" className="bp-btn bp-btn--outline bp-btn--block">
            Retour à la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bp-auth">
      <h1 className="bp-auth__title">Mot de passe oublié</h1>
      <p className="bp-auth__sub">Indiquez l&apos;adresse de votre compte : nous vous enverrons un lien pour choisir un nouveau mot de passe.</p>

      <form className="bp-card bp-form" onSubmit={onSubmit}>
        <label className="bp-field">
          <span className="bp-field__label">Email</span>
          <input
            className="bp-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            maxLength={254}
            required
            autoFocus
            disabled={loading}
          />
        </label>
        {error && <Alert kind="error">{error}</Alert>}
        <button className="bp-btn bp-btn--primary bp-btn--block bp-btn--lg" type="submit" disabled={loading}>
          {loading ? "Envoi…" : "Envoyer le lien"}
        </button>
      </form>

      <p className="bp-links">
        <Link href="/login" className="bp-link">
          Retour à la connexion
        </Link>
      </p>
    </div>
  );
}
