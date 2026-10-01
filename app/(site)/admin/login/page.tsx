"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data?.error || "Identifiants invalides.");
      return;
    }

    router.replace("/admin");
    router.refresh();
  }

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 480 }}>
        <h1 className="h1">Administration</h1>
        <p className="sub">Accès réservé.</p>

        <form onSubmit={onSubmit} className="card" style={{ marginTop: 16 }}>
          <div className="sb-form">
            <label className="sb-field">
              <span>Identifiant</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="identifiant"
                autoComplete="username"
                disabled={loading}
              />
            </label>
            <label className="sb-field">
              <span>Mot de passe</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
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
              disabled={loading || !username.trim() || !password.trim()}
              style={{ marginTop: 4 }}
            >
              {loading ? "Connexion…" : "Se connecter"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
