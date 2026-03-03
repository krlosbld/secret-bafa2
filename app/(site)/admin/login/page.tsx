"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    const data = await res.json().catch(() => ({}));

    setLoading(false);

    if (!res.ok) {
      setError(data?.error || "Erreur");
      return;
    }

    router.replace("/admin");
    router.refresh();
  }

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 520 }}>
        <h1 className="h1">Admin</h1>
        <p className="sub">Entre le code pour accéder à l’admin.</p>

        <form onSubmit={onSubmit} className="card" style={{ marginTop: 16 }}>
          <div className="row">
            <div className="label">Code</div>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ex: bankai"
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
            />
          </div>

          {error && (
            <div style={{ marginTop: 10, color: "crimson", fontWeight: 600 }}>
              {error}
            </div>
          )}

          <button
            className="btn btn-main"
            type="submit"
            disabled={loading}
            style={{ marginTop: 12, width: "100%" }}
          >
            {loading ? "Vérification..." : "Entrer"}
          </button>
        </form>
      </div>
    </main>
  );
}