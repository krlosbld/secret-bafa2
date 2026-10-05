"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// « Rejoindre une session » sans QR code : on colle le lien d'invitation reçu (ou le code qui
// le termine) et on est envoyé sur la page d'invitation de la session.
export default function JoinByLink() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const raw = value.trim();
    const token = raw.includes("/rejoindre/") ? raw.split("/rejoindre/")[1].split(/[?#/]/)[0] : raw;
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(token)) {
      setError("Ce lien n'est pas un lien d'invitation BafaPilot. Copiez-le en entier.");
      return;
    }
    router.push(`/rejoindre/${token}`);
  }

  return (
    <form className="bp-form" onSubmit={submit} style={{ marginTop: 16 }}>
      <label className="bp-field">
        <span className="bp-field__label">Lien d&apos;invitation</span>
        <input
          className="bp-input"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder="https://bafapilot.fr/rejoindre/…"
          autoComplete="off"
          inputMode="url"
        />
      </label>
      {error && (
        <div className="bp-alert bp-alert--error" role="alert">
          {error}
        </div>
      )}
      <button type="submit" className="bp-btn bp-btn--primary" disabled={!value.trim()}>
        Rejoindre la session
      </button>
    </form>
  );
}
