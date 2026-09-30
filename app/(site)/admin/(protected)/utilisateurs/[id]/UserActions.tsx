"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type UserInfo = { id: string; name: string; email: string; verified: boolean; platformRole: string; isSelf: boolean };
type FormationOption = { id: string; name: string };

const LEVELS = [
  { value: "AUCUN", label: "Utilisateur" },
  { value: "GESTIONNAIRE", label: "Gestionnaire" },
  { value: "SUPERADMIN", label: "Super-admin" },
];

async function send(url: string, method: string, body: unknown): Promise<{ ok: boolean; error?: string; data?: Record<string, unknown> }> {
  try {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data } : { ok: false, error: data.error || "L'opération a échoué." };
  } catch {
    return { ok: false, error: "Connexion impossible." };
  }
}

function Block({ title, children, danger }: { title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <section className="card" style={{ marginBottom: 16, borderLeftColor: danger ? "#dc2626" : undefined }}>
      <h3 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 800, color: danger ? "#b91c1c" : "#0f172a" }}>{title}</h3>
      {children}
    </section>
  );
}

const msg = (kind: "ok" | "error", text: string) => (
  <p style={{ margin: "8px 0 0", fontSize: 14, fontWeight: 700, color: kind === "ok" ? "#15803d" : "#dc2626" }}>{text}</p>
);

export default function UserActions({ user, managed, formations }: { user: UserInfo; managed: FormationOption[]; formations: FormationOption[] }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Record<string, { kind: "ok" | "error"; text: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [level, setLevel] = useState(user.platformRole);
  const [addFormation, setAddFormation] = useState("");

  const say = (key: string, kind: "ok" | "error", text: string) => setFeedback((f) => ({ ...f, [key]: { kind, text } }));

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string; data?: Record<string, unknown> }>, okText?: string) {
    setBusy(key);
    const r = await fn();
    setBusy(null);
    if (!r.ok) {
      say(key, "error", r.error!);
      return r;
    }
    if (okText) say(key, "ok", okText);
    router.refresh();
    return r;
  }

  async function impersonate() {
    if (!confirm(`Se connecter en tant que ${user.name} ?\n\nVous verrez BafaPilot exactement comme cette personne, pendant 1 heure au maximum. L'action est enregistrée dans le journal.`)) return;
    setBusy("imp");
    const r = await send(`/api/admin/users/${user.id}/impersonate`, "POST", {});
    if (!r.ok) {
      setBusy(null);
      say("imp", "error", r.error!);
      return;
    }
    window.location.assign(String(r.data?.next ?? "/sessions"));
  }

  async function setUserPassword() {
    if (!confirm(`Remplacer le mot de passe de ${user.name} ?\n\nToutes ses connexions en cours seront fermées.`)) return;
    const r = await run("pw", () => send(`/api/admin/users/${user.id}/password`, "POST", { password }), "Mot de passe modifié. Communiquez-le à la personne par un moyen sûr.");
    if (r.ok) setPassword("");
  }

  async function saveLevel() {
    await run("level", () => send(`/api/admin/users/${user.id}/platform-role`, "POST", { platformRole: level }), "Niveau mis à jour.");
  }

  async function deleteUser() {
    const typed = prompt(
      `Supprimer définitivement le compte de ${user.name} ?\n\nSes rattachements aux sessions seront retirés. Son historique dans le BAFA Manager (évaluations, remarques…) est conservé.\n\nPour confirmer, tapez son adresse email :\n${user.email}`
    );
    if (typed === null) return;
    if (typed.trim().toLowerCase() !== user.email.toLowerCase()) {
      say("del", "error", "L'adresse saisie ne correspond pas : compte non supprimé.");
      return;
    }
    setBusy("del");
    const r = await send(`/api/admin/users/${user.id}`, "DELETE", {});
    if (!r.ok) {
      setBusy(null);
      say("del", "error", r.error!);
      return;
    }
    window.location.assign("/admin/utilisateurs");
  }

  const input: React.CSSProperties = { flex: "1 1 220px", border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px", fontSize: 14 };
  const available = formations.filter((f) => !managed.some((m) => m.id === f.id));

  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 12px", color: "#0f172a" }}>Actions</h2>

      {!user.isSelf && user.platformRole !== "SUPERADMIN" && (
        <Block title="Se connecter en tant que">
          <p style={{ margin: "0 0 10px", fontSize: 14, color: "#475569" }}>
            Ouvre BafaPilot avec le compte de {user.name}, sans son mot de passe, pour 1 heure au maximum. Un bandeau permet de revenir à votre compte.
          </p>
          <button className="btn btn-main" disabled={busy === "imp" || !user.verified} onClick={impersonate}>
            {busy === "imp" ? "Connexion…" : `Se connecter en tant que ${user.name}`}
          </button>
          {!user.verified && msg("error", "Indisponible tant que l'adresse email n'est pas confirmée.")}
          {feedback.imp && msg(feedback.imp.kind, feedback.imp.text)}
        </Block>
      )}

      <Block title="Modifier le mot de passe">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nouveau mot de passe (8 caractères min., lettre + chiffre)"
            autoComplete="new-password"
            style={input}
          />
          <button type="button" className="btn btn-ghost" onClick={() => setShowPw((v) => !v)}>
            {showPw ? "Masquer" : "Afficher"}
          </button>
          <button className="btn btn-main" disabled={busy === "pw" || password.length === 0} onClick={setUserPassword}>
            Enregistrer
          </button>
        </div>
        {feedback.pw && msg(feedback.pw.kind, feedback.pw.text)}
      </Block>

      <Block title="Niveau du compte">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select value={level} onChange={(e) => setLevel(e.target.value)} disabled={user.isSelf} style={{ ...input, flex: "0 1 220px" }}>
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
          <button className="btn btn-main" disabled={busy === "level" || level === user.platformRole || user.isSelf} onClick={saveLevel}>
            Enregistrer
          </button>
        </div>
        {user.isSelf && msg("error", "Vous ne pouvez pas modifier votre propre niveau.")}
        {feedback.level && msg(feedback.level.kind, feedback.level.text)}

        {user.platformRole === "GESTIONNAIRE" && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Sessions qu&apos;il peut gérer</div>
            {managed.length === 0 ? (
              <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 8px" }}>Aucune session attribuée.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                {managed.map((f) => (
                  <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px" }}>
                    <span>{f.name}</span>
                    <button className="btn btn-ghost" disabled={busy === `mf-${f.id}`} onClick={() => run(`mf-${f.id}`, () => send(`/api/admin/users/${user.id}/managed-formations`, "DELETE", { formationId: f.id }))}>
                      Retirer
                    </button>
                  </div>
                ))}
              </div>
            )}
            {available.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select value={addFormation} onChange={(e) => setAddFormation(e.target.value)} style={input}>
                  <option value="">Choisir une session…</option>
                  {available.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <button
                  className="btn btn-main"
                  disabled={!addFormation || busy === "mf-add"}
                  onClick={async () => {
                    const r = await run("mf-add", () => send(`/api/admin/users/${user.id}/managed-formations`, "POST", { formationId: addFormation }));
                    if (r.ok) setAddFormation("");
                  }}
                >
                  Attribuer
                </button>
              </div>
            )}
            {feedback["mf-add"] && msg(feedback["mf-add"].kind, feedback["mf-add"].text)}
          </div>
        )}
      </Block>

      {!user.isSelf && (
        <Block title="Supprimer le compte" danger>
          <p style={{ margin: "0 0 10px", fontSize: 14, color: "#475569" }}>
            Supprime le compte et ses rattachements aux sessions. L&apos;historique du BAFA Manager (fiches, évaluations, remarques) est conservé.
          </p>
          <button className="btn btn-danger" disabled={busy === "del"} onClick={deleteUser}>
            Supprimer ce compte
          </button>
          {feedback.del && msg(feedback.del.kind, feedback.del.text)}
        </Block>
      )}
    </div>
  );
}
