"use client";

import { useState } from "react";
import Link from "next/link";
import { PasswordInput, Alert, postJson } from "../_components/ui";

export default function ResetForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; linkDead: boolean } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError({ message: "Les deux mots de passe ne correspondent pas.", linkDead: false });
      return;
    }
    setLoading(true);
    const r = await postJson("/api/auth/reset-password", { token, password, confirm });
    if (!r.ok) {
      setLoading(false);
      setError({ message: String(r.data.error ?? "Le mot de passe n'a pas pu être modifié."), linkDead: ["invalid", "used", "expired"].includes(String(r.data.code)) });
      return;
    }
    window.location.assign("/login?notice=reset");
  }

  return (
    <div className="bp-auth">
      <h1 className="bp-auth__title">Nouveau mot de passe</h1>
      <p className="bp-auth__sub">Choisissez le nouveau mot de passe de votre compte BafaPilot.</p>

      <form className="bp-card bp-form" onSubmit={onSubmit}>
        <PasswordInput
          label="Nouveau mot de passe"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          hint="Au moins 8 caractères, dont une lettre et un chiffre."
          disabled={loading}
          autoFocus
        />
        <PasswordInput label="Confirmation" value={confirm} onChange={setConfirm} autoComplete="new-password" disabled={loading} />
        {error && (
          <Alert kind="error">
            {error.message}
            {error.linkDead && (
              <>
                {" "}
                <Link href="/forgot-password" className="bp-link">
                  Demander un nouveau lien
                </Link>
              </>
            )}
          </Alert>
        )}
        <button className="bp-btn bp-btn--primary bp-btn--block bp-btn--lg" type="submit" disabled={loading}>
          {loading ? "Enregistrement…" : "Enregistrer le mot de passe"}
        </button>
      </form>
    </div>
  );
}
