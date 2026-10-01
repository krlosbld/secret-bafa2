"use client";

import { useState } from "react";
import Link from "next/link";
import { PasswordInput, Alert, postJson, ResendVerification } from "../_components/ui";
import { LegacyCodeField } from "../rejoindre/[token]/JoinButton";

export default function RegisterForm({
  invite,
  inviteInvalid,
}: {
  invite: { token: string; sessionName: string } | null;
  inviteInvalid: boolean;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [legacyCode, setLegacyCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [done, setDone] = useState<{
    email: string;
    mailSent: boolean;
    joinedSession: string | null;
    recoveredHistory: boolean;
    legacyCodeRejected: boolean;
  } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError({ message: "Les deux mots de passe ne correspondent pas." });
      return;
    }
    setLoading(true);
    const r = await postJson("/api/auth/register", { firstName, lastName, email, password, confirm, inviteToken: invite?.token, legacyCode: invite ? legacyCode : "" });
    setLoading(false);
    if (!r.ok) {
      setError({ message: String(r.data.error ?? "Inscription impossible."), code: r.data.code as string | undefined });
      return;
    }
    setDone({
      email: String(r.data.email),
      mailSent: !!r.data.mailSent,
      joinedSession: (r.data.joinedSession as string | null) ?? null,
      recoveredHistory: !!r.data.recoveredHistory,
      legacyCodeRejected: !!r.data.legacyCodeRejected,
    });
  }

  if (done) {
    return (
      <div className="bp-auth">
        <div className="bp-card bp-status">
          <div className="bp-status__icon" aria-hidden>
            ✉️
          </div>
          <h1 className="bp-status__title">Confirmez votre adresse email</h1>
          {done.joinedSession && (
            <div className="bp-alert bp-alert--ok" style={{ marginBottom: 14, textAlign: "left" }}>
              Vous êtes inscrit à la session <strong>{done.joinedSession}</strong> en tant que stagiaire
              {done.recoveredHistory ? ", avec votre historique récupéré" : ""}. Elle apparaîtra dans « Ma session » après confirmation de votre
              adresse.
            </div>
          )}
          {done.legacyCodeRejected && (
            <div className="bp-alert bp-alert--error" style={{ marginBottom: 14, textAlign: "left" }}>
              L&apos;ancien code ne correspondait pas à votre prénom : une nouvelle fiche a été créée. Prévenez votre directeur ou directrice pour
              retrouver votre historique.
            </div>
          )}
          {done.mailSent ? (
            <p className="bp-status__text">
              Votre compte est créé. Nous venons d&apos;envoyer un lien de confirmation à <strong>{done.email}</strong>.
              <br />
              Ouvrez-le pour activer votre compte : il est valable 24 heures.
            </p>
          ) : (
            <p className="bp-status__text">
              Votre compte est créé, mais l&apos;email de confirmation n&apos;a pas pu être envoyé à <strong>{done.email}</strong>. Réessayez avec
              le bouton ci-dessous.
            </p>
          )}
          <ResendVerification email={done.email} />
          <p className="bp-links">
            Pas reçu ? Regardez dans vos spams avant de renvoyer l&apos;email.
            <br />
            Déjà confirmé ?{" "}
            <Link href="/login" className="bp-link">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bp-auth">
      <h1 className="bp-auth__title">Créer mon compte</h1>
      <p className="bp-auth__sub">Un seul compte pour retrouver toutes vos sessions BAFA.</p>
      {invite && (
        <div className="bp-alert bp-alert--info" style={{ marginBottom: 16 }}>
          Vous rejoindrez la session <strong>{invite.sessionName}</strong> en tant que stagiaire.
        </div>
      )}
      {inviteInvalid && (
        <div className="bp-alert bp-alert--error" style={{ marginBottom: 16 }}>
          Ce lien d&apos;invitation n&apos;est plus valide : votre compte sera créé sans rattachement. Demandez le nouveau QR code à votre directeur ou
          directrice.
        </div>
      )}

      <form className="bp-card bp-form" onSubmit={onSubmit} noValidate>
        <div className="bp-row">
          <label className="bp-field">
            <span className="bp-field__label">Prénom</span>
            <input className="bp-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" maxLength={60} required autoFocus disabled={loading} />
          </label>
          <label className="bp-field">
            <span className="bp-field__label">Nom</span>
            <input className="bp-input" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" maxLength={60} required disabled={loading} />
          </label>
        </div>
        <label className="bp-field">
          <span className="bp-field__label">Email</span>
          <input className="bp-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" maxLength={254} required disabled={loading} />
        </label>
        <PasswordInput
          label="Mot de passe"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          hint="Au moins 8 caractères, dont une lettre et un chiffre."
          disabled={loading}
        />
        <PasswordInput label="Confirmation du mot de passe" value={confirm} onChange={setConfirm} autoComplete="new-password" disabled={loading} />
        {invite && <LegacyCodeField value={legacyCode} onChange={setLegacyCode} disabled={loading} />}

        {error && (
          <Alert kind="error">
            {error.message}
            {error.code === "EMAIL_TAKEN" && (
              <>
                {" "}
                <Link href="/login" className="bp-link">
                  Se connecter
                </Link>{" "}
                ou{" "}
                <Link href="/forgot-password" className="bp-link">
                  mot de passe oublié
                </Link>
                .
              </>
            )}
          </Alert>
        )}

        <button className="bp-btn bp-btn--primary bp-btn--block bp-btn--lg" type="submit" disabled={loading}>
          {loading ? "Création du compte…" : "Créer mon compte"}
        </button>
      </form>

      <p className="bp-links">
        Déjà un compte ?{" "}
        <Link href={invite ? `/login?next=${encodeURIComponent(`/rejoindre/${invite.token}`)}` : "/login"} className="bp-link">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
