"use client";

import { useState } from "react";
import Link from "next/link";
import { PasswordInput, Alert, postJson, ResendVerification } from "../_components/ui";

export default function LoginForm({ next, notice }: { next: string; notice: "reset" | "verified" | "logged_out" | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const r = await postJson("/api/auth/login", { email, password, next });
    if (!r.ok) {
      setLoading(false);
      setError({ message: String(r.data.error ?? "Connexion impossible."), code: r.data.code as string | undefined });
      return;
    }
    // Navigation complète : l'en-tête et les pages serveur relisent la nouvelle session.
    window.location.assign(String(r.data.next ?? "/sessions"));
  }

  return (
    <div className="bp-auth">
      <h1 className="bp-auth__title">Se connecter</h1>
      <p className="bp-auth__sub">Retrouvez vos sessions BAFA.</p>

      <form className="bp-card bp-form" onSubmit={onSubmit}>
        {notice === "verified" && <Alert kind="ok">Votre adresse email est confirmée. Vous pouvez vous connecter.</Alert>}
        {notice === "reset" && <Alert kind="ok">Votre mot de passe a été modifié. Connectez-vous avec le nouveau.</Alert>}
        {notice === "logged_out" && <Alert kind="info">Vous êtes déconnecté.</Alert>}

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
        <PasswordInput label="Mot de passe" value={password} onChange={setPassword} autoComplete="current-password" disabled={loading} />

        <div style={{ textAlign: "right", marginTop: -6 }}>
          <Link href="/forgot-password" className="bp-link" style={{ fontSize: "0.88rem" }}>
            Mot de passe oublié ?
          </Link>
        </div>

        {error && <Alert kind="error">{error.message}</Alert>}
        {error?.code === "EMAIL_NOT_VERIFIED" && <ResendVerification email={email} />}

        <button className="bp-btn bp-btn--primary bp-btn--block bp-btn--lg" type="submit" disabled={loading}>
          {loading ? "Connexion…" : "Se connecter"}
        </button>
      </form>

      <p className="bp-links">
        Pas encore de compte ?{" "}
        <Link href="/register" className="bp-link">
          Créer mon compte
        </Link>
      </p>
    </div>
  );
}
