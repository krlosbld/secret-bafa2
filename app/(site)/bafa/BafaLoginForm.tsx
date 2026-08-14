"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BafaLoginForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/bafa/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data?.error || "Code invalide.");
      return;
    }

    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card" style={{ margin: "16px auto 0", maxWidth: 360 }}>
      <div className="sb-form">
        <label className="sb-field">
          <span>Ton code personnel</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="Ex : 4823"
            inputMode="numeric"
            maxLength={4}
            disabled={loading}
          />
        </label>

        {error && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 10,
              padding: 10,
              color: "#dc2626",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        <button
          className="sb-btn sb-btn--main"
          type="submit"
          disabled={loading || code.length !== 4}
          style={{ marginTop: 4 }}
        >
          {loading ? "Connexion…" : "Se connecter"}
        </button>
      </div>
    </form>
  );
}
