"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Équipe d'une session (comptes BafaPilot rattachés) + « Ajouter un membre » : rechercher un compte
// existant, choisir Directeur ou Formateur, valider — rattachement immédiat, sans code de session.
// Utilisé dans l'administration (super-admin) et dans l'espace gestionnaire.

export type TeamMember = { id: string; role: string; name: string; email: string; verified: boolean; playerName: string | null };
type SearchResult = { id: string; name: string; email: string; verified: boolean; alreadyMemberAs: string | null };
type Linkable = { id: string; firstName: string; role: string };
type PendingInvite = { id: string; email: string; role: string; expiresAt: string };

const ROLES = [
  { value: "DIRECTEUR", label: "Directeur" },
  { value: "FORMATEUR", label: "Formateur" },
];
const roleLabel = (r: string) => ROLES.find((x) => x.value === r)?.label ?? r;

async function send(url: string, method: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, error: data.error || "L'opération a échoué." };
  } catch {
    return { ok: false, error: "Connexion impossible." };
  }
}

const badge = (bg: string, color: string): React.CSSProperties => ({
  fontSize: 11,
  fontWeight: 800,
  padding: "2px 8px",
  borderRadius: 999,
  background: bg,
  color,
  whiteSpace: "nowrap",
});

export default function TeamManager({
  formationId,
  members,
  linkable,
  invites = [],
}: {
  formationId: string;
  members: TeamMember[];
  linkable: Linkable[];
  invites?: PendingInvite[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function changeRole(m: TeamMember, role: string) {
    setBusy(m.id);
    setError(null);
    const r = await send(`/api/team/members/${m.id}`, "PATCH", { role });
    if (!r.ok) setError(r.error!);
    router.refresh();
    setBusy(null);
  }

  async function remove(m: TeamMember) {
    if (!confirm(`Retirer ${m.name} de l'équipe de cette session ?\n\nSon historique dans le BAFA Manager (évaluations, remarques…) est conservé.`)) return;
    setBusy(m.id);
    setError(null);
    const r = await send(`/api/team/members/${m.id}`, "DELETE", {});
    if (!r.ok) setError(r.error!);
    router.refresh();
    setBusy(null);
  }

  return (
    <div>
      {members.length === 0 ? (
        <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 12px" }}>Aucun compte BafaPilot n&apos;est encore rattaché à cette session.</p>
      ) : (
        <div className="cards" style={{ marginBottom: 12 }}>
          {members.map((m) => (
            <div key={m.id} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, color: "#0f172a", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {m.name}
                  {!m.verified && <span style={badge("#fef3c7", "#92400e")}>Email non confirmé</span>}
                </div>
                <div style={{ fontSize: 13, color: "#64748b", wordBreak: "break-all" }}>{m.email}</div>
                {m.playerName && <div style={{ fontSize: 12, color: "#94a3b8" }}>Fiche BAFA Manager : {m.playerName}</div>}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select
                  value={m.role}
                  disabled={busy === m.id}
                  onChange={(e) => changeRole(m, e.target.value)}
                  aria-label={`Rôle de ${m.name}`}
                  style={{ border: "1px solid #ddd", borderRadius: 8, padding: "6px 8px", fontWeight: 700 }}
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <button className="btn btn-ghost" disabled={busy === m.id} onClick={() => remove(m)}>
                  Retirer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p style={{ color: "#dc2626", fontWeight: 700, fontSize: 14 }}>{error}</p>}

      {adding ? (
        <AddMember formationId={formationId} linkable={linkable} onDone={() => setAdding(false)} />
      ) : (
        <button className="btn btn-main" onClick={() => setAdding(true)}>
          + Ajouter un membre
        </button>
      )}

      <InviteByEmail formationId={formationId} invites={invites} />
    </div>
  );
}

// Inviter par email une personne qui n'a pas encore de compte (ou qui en a un) : elle reçoit un lien
// personnel, crée son compte et se retrouve rattachée à la session avec le rôle choisi.
function InviteByEmail({ formationId, invites }: { formationId: string; invites: PendingInvite[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("DIRECTEUR");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function invite() {
    setSending(true);
    setMessage(null);
    const r = await send(`/api/team/${formationId}/invites`, "POST", { email, role });
    setSending(false);
    if (!r.ok) {
      setMessage({ ok: false, text: r.error! });
      return;
    }
    setMessage({ ok: true, text: `Invitation envoyée à ${email.trim()} ✓` });
    setEmail("");
    router.refresh();
  }

  async function revoke(i: PendingInvite) {
    if (!confirm(`Annuler l'invitation envoyée à ${i.email} ?`)) return;
    const r = await send(`/api/team/invites/${i.id}`, "DELETE", {});
    if (!r.ok) setMessage({ ok: false, text: r.error! });
    router.refresh();
  }

  return (
    <div className="card" style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <div style={{ fontWeight: 800 }}>Inviter par email</div>
        <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748b" }}>
          La personne reçoit un lien pour créer son compte : elle est rattachée automatiquement à la session (lien personnel, 7 jours).
        </p>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="adresse@email.fr"
          style={{ flex: "1 1 220px", border: "1px solid #ddd", borderRadius: 8, padding: "9px 10px", fontSize: 14 }}
        />
        {ROLES.map((r) => (
          <button key={r.value} type="button" className={`btn ${role === r.value ? "btn-main" : "btn-ghost"}`} onClick={() => setRole(r.value)}>
            {r.label}
          </button>
        ))}
        <button type="button" className="btn btn-main" onClick={invite} disabled={sending || !email.trim()}>
          {sending ? "Envoi…" : "Envoyer l'invitation"}
        </button>
      </div>
      {message && <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: message.ok ? "#15803d" : "#dc2626" }}>{message.text}</p>}
      {invites.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>En attente</div>
          {invites.map((i) => (
            <div key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 14 }}>
              <span>
                <strong>{i.email}</strong> · {roleLabel(i.role)}{" "}
                <span style={{ color: "#94a3b8" }}>(expire le {new Date(i.expiresAt).toLocaleDateString("fr-FR")})</span>
              </span>
              <button type="button" className="btn btn-ghost" onClick={() => revoke(i)}>
                Annuler
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddMember({ formationId, linkable, onDone }: { formationId: string; linkable: Linkable[]; onDone: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [role, setRole] = useState("FORMATEUR");
  const [linkPlayerId, setLinkPlayerId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selected || q.trim().length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/team/${formationId}/search?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal });
        const data = await res.json();
        setResults(Array.isArray(data.users) ? data.users : []);
      } catch {
        /* recherche annulée ou réseau indisponible */
      }
      setSearching(false);
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, selected, formationId]);

  // Résultats affichés seulement pour une recherche en cours (au moins 2 caractères, aucun compte choisi).
  const shown = selected || q.trim().length < 2 ? [] : results;

  async function submit() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    const r = await send(`/api/team/${formationId}/members`, "POST", { userId: selected.id, role, linkPlayerId: linkPlayerId || null });
    setSaving(false);
    if (!r.ok) {
      setError(r.error!);
      return;
    }
    router.refresh();
    onDone();
  }

  const field: React.CSSProperties = { width: "100%", border: "1px solid #ddd", borderRadius: 8, padding: "9px 10px", fontSize: 14 };

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontWeight: 800 }}>Ajouter un membre</div>

      {!selected ? (
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>1. Rechercher un compte (nom, prénom ou email)</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ex : Dupont, claire@…" autoFocus style={field} />
          {searching && <p style={{ fontSize: 13, color: "#64748b" }}>Recherche…</p>}
          {!searching && q.trim().length >= 2 && shown.length === 0 && (
            <p style={{ fontSize: 13, color: "#64748b" }}>Aucun compte trouvé. La personne doit d&apos;abord créer son compte sur BafaPilot.</p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            {shown.map((u) => (
              <button
                key={u.id}
                type="button"
                disabled={!!u.alreadyMemberAs}
                onClick={() => setSelected(u)}
                style={{ textAlign: "left", border: "1px solid #e2e8f0", background: "#fff", borderRadius: 8, padding: "8px 10px", cursor: u.alreadyMemberAs ? "default" : "pointer", opacity: u.alreadyMemberAs ? 0.6 : 1 }}
              >
                <strong>{u.name}</strong> <span style={{ color: "#64748b" }}>· {u.email}</span>
                {!u.verified && <span style={{ ...badge("#fef3c7", "#92400e"), marginLeft: 6 }}>Email non confirmé</span>}
                {u.alreadyMemberAs && <span style={{ ...badge("#e2e8f0", "#334155"), marginLeft: 6 }}>Déjà {roleLabel(u.alreadyMemberAs).toLowerCase()}</span>}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div>
              <strong>{selected.name}</strong> <span style={{ color: "#64748b" }}>· {selected.email}</span>
            </div>
            <button type="button" className="btn btn-ghost" onClick={() => setSelected(null)}>
              Changer
            </button>
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>2. Rôle dans cette session</div>
            <div style={{ display: "flex", gap: 8 }}>
              {ROLES.map((r) => (
                <button key={r.value} type="button" className={`btn ${role === r.value ? "btn-main" : "btn-ghost"}`} onClick={() => setRole(r.value)}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {linkable.length > 0 && (
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                Fiche BAFA Manager <span style={{ fontWeight: 400, color: "#64748b" }}>(facultatif)</span>
              </label>
              <select value={linkPlayerId} onChange={(e) => setLinkPlayerId(e.target.value)} style={field}>
                <option value="">Créer une nouvelle fiche pour ce compte</option>
                {linkable.map((p) => (
                  <option key={p.id} value={p.id}>
                    Reprendre la fiche existante « {p.firstName} » ({roleLabel(p.role)})
                  </option>
                ))}
              </select>
              <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>
                Reprendre la fiche d&apos;un membre déjà présent conserve son historique (évaluations, créneaux…).
              </p>
            </div>
          )}

          {error && <p style={{ color: "#dc2626", fontWeight: 700, fontSize: 14, margin: 0 }}>{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-main" disabled={saving} onClick={submit}>
              {saving ? "Ajout…" : "Valider"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onDone}>
              Annuler
            </button>
          </div>
        </>
      )}

      {!selected && (
        <div>
          <button type="button" className="btn btn-ghost" onClick={onDone}>
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}
