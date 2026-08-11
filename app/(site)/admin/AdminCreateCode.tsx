"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const ROLE_LABELS: Record<string, string> = {
  DIRECTEUR: "Directeur",
  FORMATEUR: "Formateur",
  STAGIAIRE: "Stagiaire",
};

type DirectorAccountOption = { id: string; firstName: string; username: string };

export default function AdminCreateCode({
  formationId,
  directorAccounts,
  allowDirector = true,
}: {
  formationId: string;
  directorAccounts: DirectorAccountOption[];
  allowDirector?: boolean;
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [role, setRole] = useState(allowDirector ? "DIRECTEUR" : "FORMATEUR");
  const [directorSource, setDirectorSource] = useState<"existing" | "new">(directorAccounts.length > 0 ? "existing" : "new");
  const [existingDirectorAccountId, setExistingDirectorAccountId] = useState(directorAccounts[0]?.id ?? "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ firstName: string; role: string; code: string | null; username: string | null } | null>(null);

  const isDirector = role === "DIRECTEUR";
  const useExisting = isDirector && directorSource === "existing" && directorAccounts.length > 0;

  async function create() {
    setError("");
    setCreated(null);
    if (useExisting) {
      if (!existingDirectorAccountId) {
        setError("Choisis un directeur existant.");
        return;
      }
    } else {
      if (!firstName.trim()) {
        setError("Prénom requis.");
        return;
      }
      if (isDirector && (!username.trim() || !password.trim())) {
        setError("Identifiant et mot de passe requis pour un nouveau directeur.");
        return;
      }
    }
    setLoading(true);
    const res = await fetch(`/api/admin/formations/${formationId}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName,
        role,
        existingDirectorAccountId: useExisting ? existingDirectorAccountId : undefined,
        username: isDirector && !useExisting ? username.trim() : undefined,
        password: isDirector && !useExisting ? password.trim() : undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data?.error || "Erreur.");
      return;
    }
    setFirstName("");
    setUsername("");
    setPassword("");
    setCreated(data.player);
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="card">
        <div style={{ fontWeight: 800, marginBottom: 12 }}>Créer un code</div>
        <div className="sb-form">
          <label className="sb-field">
            <span>Rôle</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={loading}
              style={{ border: "1px solid #ddd", borderRadius: 6, padding: "6px 8px", fontSize: 14 }}
            >
              {Object.entries(ROLE_LABELS)
                .filter(([value]) => allowDirector || value !== "DIRECTEUR")
                .map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
            </select>
          </label>

          {isDirector && directorAccounts.length > 0 && (
            <label className="sb-field">
              <span>Directeur</span>
              <select
                value={directorSource}
                onChange={(e) => setDirectorSource(e.target.value as "existing" | "new")}
                disabled={loading}
                style={{ border: "1px solid #ddd", borderRadius: 6, padding: "6px 8px", fontSize: 14 }}
              >
                <option value="existing">Déjà existant</option>
                <option value="new">Nouveau</option>
              </select>
            </label>
          )}

          {useExisting ? (
            <label className="sb-field">
              <span>Choisir le directeur</span>
              <select
                value={existingDirectorAccountId}
                onChange={(e) => setExistingDirectorAccountId(e.target.value)}
                disabled={loading}
                style={{ border: "1px solid #ddd", borderRadius: 6, padding: "6px 8px", fontSize: 14 }}
              >
                {directorAccounts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.firstName} ({d.username})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="sb-field">
              <span>Prénom</span>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="ex. Marie"
                disabled={loading}
              />
            </label>
          )}

          {isDirector && !useExisting ? (
            <>
              <label className="sb-field">
                <span>Identifiant</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ex. marie.bafa"
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
                  disabled={loading}
                />
              </label>
            </>
          ) : !isDirector ? (
            <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
              Un code à 4 chiffres sera généré automatiquement pour se connecter sur /bafa.
            </p>
          ) : null}

          {error && <div style={{ color: "#dc2626", fontSize: 14, fontWeight: 600 }}>{error}</div>}
          <button className="btn btn-main" onClick={create} disabled={loading} style={{ alignSelf: "flex-start" }}>
            {loading ? "Création…" : "Créer"}
          </button>
        </div>
      </div>

      {created && (
        <div className="card" style={{ borderLeftColor: "#16a34a", background: "#f0fdf4" }}>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>Code créé ✅</div>
          {created.username ? (
            <p style={{ margin: 0, fontSize: 14 }}>
              {created.firstName} ({ROLE_LABELS[created.role] ?? created.role}) se connecte via <code>/admin/login</code>{" "}
              avec l&apos;identifiant <strong>{created.username}</strong> et le mot de passe choisi — ni l&apos;un ni
              l&apos;autre ne seront réaffichés.
            </p>
          ) : created.code ? (
            <p style={{ margin: 0, fontSize: 14 }}>
              {created.firstName} ({ROLE_LABELS[created.role] ?? created.role}) se connecte sur <code>/bafa</code> avec
              le code <span style={{ fontWeight: 900, fontSize: 18, color: "#16a34a" }}>{created.code}</span> — à lui
              communiquer, il ne sera pas réaffiché.
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: 14 }}>
              {created.firstName} ({ROLE_LABELS[created.role] ?? created.role}) peut déjà se connecter avec ses
              identifiants habituels — cette formation apparaîtra dans son écran de choix.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
