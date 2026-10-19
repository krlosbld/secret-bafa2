"use client";

import { useEffect, useState } from "react";
import type { MysteryState } from "@/lib/mysteryBuzz";
import type { FakeIdentityState } from "@/lib/fakeIdentity";
import type { BountyState } from "@/lib/bounty";
import type { LeaderState } from "@/lib/leaderPrivilege";
import { LEADER_OPTIONS } from "@/components/LeaderPrivilegeGate";

// « Mes pouvoirs » (onglet Jeu, joueur) : uniquement les pouvoirs du joueur connecté.
// Rafraîchi régulièrement (réponse du maître du jeu, fin d'un camouflage).
const STATUS: Record<string, { label: string; tone: string }> = {
  PENDING: { label: "En attente de la réponse du maître du jeu", tone: "#b45309" },
  ANSWERED: { label: "Réponse", tone: "#15803d" },
  REFUSED: { label: "Refusée — tu peux reformuler", tone: "#b91c1c" },
  CLOSED: { label: "Close (partie terminée)", tone: "#64748b" },
};

type Powers = { mystery: MysteryState; fakeIdentity: FakeIdentityState; bounty: BountyState; leader: LeaderState };

function remaining(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "terminée";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
}
const day = (iso: string) => new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function MyPowers({ initial, secretOptions = [] }: { initial: Powers; secretOptions?: { id: string; content: string }[] }) {
  const [state, setState] = useState(initial);
  const [, setTick] = useState(0);

  async function reload() {
    const res = await fetch("/api/game/powers", { cache: "no-store" }).catch(() => null);
    const data = res?.ok ? await res.json().catch(() => null) : null;
    if (data?.ok) setState({ mystery: data.mystery, fakeIdentity: data.fakeIdentity, bounty: data.bounty, leader: data.leader });
  }

  useEffect(() => {
    const id = setInterval(() => {
      void reload();
      setTick((t) => t + 1); // temps restant
    }, 20000);
    return () => clearInterval(id);
  }, []);

  const { mystery, fakeIdentity, bounty, leader } = state;
  const showBounty = bounty.enabled || bounty.used !== null;
  const showMystery = mystery.enabled || mystery.questions.length > 0;
  const showFake = fakeIdentity.enabled || fakeIdentity.used !== null;
  const answered = mystery.questions.find((q) => q.status === "ANSWERED");

  return (
    <section className="card my-powers" style={{ marginBottom: 20 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>Mes pouvoirs</div>

      {leader.today && <LeaderItem state={leader} secretOptions={secretOptions} onChange={(l) => setState((s) => ({ ...s, leader: l }))} />}

      {showFake && <FakeIdentityItem state={fakeIdentity} onBought={(f) => setState((s) => ({ ...s, fakeIdentity: f }))} />}

      {showBounty && (
        <BountyItem
          state={bounty}
          onActivated={(b) => {
            setState((s) => ({ ...s, bounty: b }));
            void reload(); // la fausse identité devient indisponible (incompatibilité)
          }}
        />
      )}

      {showMystery && (
        <div className="my-powers__item">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <strong>❓ Buzz mystère</strong>
            <span style={{ fontSize: 13, fontWeight: 700, color: mystery.available ? "#15803d" : answered ? "#64748b" : "#b45309" }}>
              {mystery.available ? "Disponible" : answered ? "Utilisé" : mystery.reason}
            </span>
          </div>
          <p style={{ fontSize: 13, color: "#475569", margin: "4px 0 0" }}>
            Une fois par partie, pose au maître du jeu une question fermée sur un secret : il répond seulement « Oui » ou « Non ». Pas de
            question sur l&apos;identité de l&apos;auteur (prénom, groupe, rôle, genre…). Gratuit, hors quota de buzz, de 9 h à 18 h.
            {mystery.available && " Utilise le bouton « ❓ Buzz mystère » sous le secret de ton choix."}
          </p>
          {mystery.questions.length > 0 && (
            <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "flex", flexDirection: "column", gap: 8 }}>
              {mystery.questions.map((q) => (
                <li key={q.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 10px", fontSize: 13 }}>
                  <div style={{ color: "#64748b" }}>Secret : « {q.secretContent} »</div>
                  <div style={{ fontWeight: 700, margin: "2px 0" }}>{q.text}</div>
                  <div style={{ color: STATUS[q.status]?.tone ?? "#475569", fontWeight: 700 }}>
                    {STATUS[q.status]?.label ?? q.status}
                    {q.status === "ANSWERED" && ` : ${q.answer === "OUI" ? "✅ Oui" : "❌ Non"}`}
                  </div>
                  {q.status === "REFUSED" && q.refusalReason && <div style={{ color: "#7f1d1d" }}>Motif : {q.refusalReason}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function FakeIdentityItem({ state, onBought }: { state: FakeIdentityState; onBought: (s: FakeIdentityState) => void }) {
  const [open, setOpen] = useState(false);
  const [alias, setAlias] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const aliasName = state.candidates.find((c) => c.id === alias)?.firstName ?? "";

  async function buy() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/game/powers/fake-identity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aliasPlayerId: alias }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) {
      setError(data.error || "Achat impossible.");
      return;
    }
    onBought(data.fakeIdentity);
    setOpen(false);
  }

  const status = state.active
    ? { text: `Active — encore ${remaining(state.active.endsAt)}`, tone: "#6b21a8" }
    : state.used
      ? { text: "Déjà utilisée", tone: "#64748b" }
      : state.available
        ? { text: "Disponible", tone: "#15803d" }
        : { text: state.reason ?? "Indisponible", tone: "#b45309" };

  return (
    <div className="my-powers__item">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <strong>🎭 Fausse identité</strong>
        <span style={{ fontSize: 13, fontWeight: 700, color: status.tone }} suppressHydrationWarning>
          {status.text}
        </span>
      </div>
      <p style={{ fontSize: 13, color: "#475569", margin: "4px 0 0" }}>
        Pendant {state.hours} h, emprunte le prénom d&apos;un autre participant : sur ton secret, un buzz proposant ton vrai prénom ou le
        prénom emprunté sera jugé faux. Personne ne le saura. Coût : <strong>{state.cost} points</strong>. Une fois par partie, avec un
        secret validé et pas encore trouvé.
      </p>
      {state.active && (
        <p style={{ fontSize: 13, margin: "6px 0 0", color: "#6b21a8", fontWeight: 600 }} suppressHydrationWarning>
          Tu es camouflé(e) en « {state.active.aliasLabel} » jusqu&apos;au {day(state.active.endsAt)}.
        </p>
      )}
      {!state.active && state.used && (
        <p style={{ fontSize: 13, margin: "6px 0 0", color: "#64748b" }}>
          Utilisée{state.used.aliasLabel ? ` (« ${state.used.aliasLabel} »)` : ""} du {day(state.used.startsAt)} au {day(state.used.endsAt)}.
        </p>
      )}
      {state.available && !open && (
        <button className="btn btn-main" style={{ marginTop: 8, padding: "7px 14px", fontSize: 14 }} onClick={() => (setOpen(true), setConfirming(false), setAlias(""), setError(""))}>
          🎭 Acheter ma fausse identité ({state.cost} pts)
        </button>
      )}
      {open && (
        <div style={{ marginTop: 8, border: "1px solid #e9d5ff", background: "#faf5ff", borderRadius: 10, padding: 10 }}>
          {!confirming ? (
            <>
              <label className="sb-field">
                <span>Quel prénom emprunter ?</span>
                <select value={alias} onChange={(e) => setAlias(e.target.value)} disabled={busy}>
                  <option value="">Choisis un participant…</option>
                  {state.candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName}
                    </option>
                  ))}
                </select>
              </label>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="btn btn-main" disabled={!alias} onClick={() => setConfirming(true)}>
                  Continuer
                </button>
                <button className="btn btn-ghost" onClick={() => setOpen(false)}>
                  Annuler
                </button>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: 14, margin: "0 0 8px", lineHeight: 1.5 }}>
                <strong>Confirmer l&apos;achat ?</strong>
                <br />• {state.cost} points débités tout de suite (non remboursables).
                <br />• Pendant {state.hours} h, sur ton secret, ton vrai prénom et « {aliasName} » seront jugés faux.
                <br />• Les buzz déjà envoyés ne sont pas concernés. Le secret de {aliasName} n&apos;est pas touché.
                <br />• Une seule fois par partie.
              </p>
              {error && <p style={{ color: "#dc2626", fontWeight: 600, fontSize: 13, margin: "0 0 8px" }}>{error}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-main" disabled={busy} onClick={buy}>
                  {busy ? "…" : `Confirmer (${state.cost} pts)`}
                </button>
                <button className="btn btn-ghost" disabled={busy} onClick={() => setConfirming(false)}>
                  Retour
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function BountyItem({ state, onActivated }: { state: BountyState; onActivated: (s: BountyState) => void }) {
  const [open, setOpen] = useState(false);
  const [stake, setStake] = useState(1);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const maxAllowed = Math.min(state.maxStake, state.points);

  async function activate() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/game/powers/bounty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stake }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) {
      setError(data.error || "Activation impossible.");
      return;
    }
    onActivated(data.bounty);
    setOpen(false);
  }

  const a = state.active;
  const status = a
    ? a.awaiting
      ? { text: "24 h écoulées — en attente d'une validation", tone: "#b45309" }
      : { text: `Active — encore ${remaining(a.endsAt)}`, tone: "#b91c1c" }
    : state.used
      ? { text: "Déjà utilisé", tone: "#64748b" }
      : state.available
        ? { text: "Disponible", tone: "#15803d" }
        : { text: state.reason ?? "Indisponible", tone: "#b45309" };
  const OUTCOME: Record<string, string> = { REFUNDED: "Mise rendue", WON: "Mise gagnée par celui qui a trouvé ton secret" };

  return (
    <div className="my-powers__item">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <strong>🎯 Secret mis à prix</strong>
        <span style={{ fontSize: 13, fontWeight: 700, color: status.tone }} suppressHydrationWarning>
          {status.text}
        </span>
      </div>
      <p style={{ fontSize: 13, color: "#475569", margin: "4px 0 0" }}>
        Pendant {state.hours} h, mets en jeu de 1 à {state.maxStake} points : chaque adversaire qui propose ton prénom à tort te verse ta
        mise (une fois chacun, dans la limite de ses points). Si ton secret est trouvé pendant ces {state.hours} h, ta mise va à celui
        qui l&apos;a trouvé ; sinon elle t&apos;est rendue. Une fois par partie.
      </p>
      {a && (
        <p style={{ fontSize: 13, margin: "6px 0 0", color: "#b91c1c", fontWeight: 600 }}>
          Mise en réserve : {a.stake} point{a.stake > 1 ? "s" : ""} · {a.hits} erreur{a.hits > 1 ? "s" : ""} sur ton prénom, {a.gained} point
          {a.gained > 1 ? "s" : ""} reçu{a.gained > 1 ? "s" : ""}.
          {a.awaiting && " Une bonne réponse envoyée pendant la mise attend la validation du maître du jeu : ta mise sera réglée ensuite."}
        </p>
      )}
      {!a && state.used && (
        <p style={{ fontSize: 13, margin: "6px 0 0", color: "#64748b" }}>
          Mise de {state.used.stake} point{state.used.stake > 1 ? "s" : ""} du {day(state.used.startsAt)} au {day(state.used.endsAt)} ·{" "}
          {state.used.hits} erreur{state.used.hits > 1 ? "s" : ""} sur ton prénom, {state.used.gained} point{state.used.gained > 1 ? "s" : ""}{" "}
          reçu{state.used.gained > 1 ? "s" : ""} · {state.used.outcome ? OUTCOME[state.used.outcome] : ""}
        </p>
      )}
      {state.available && !open && (
        <button
          className="btn btn-main"
          style={{ marginTop: 8, padding: "7px 14px", fontSize: 14 }}
          onClick={() => (setOpen(true), setConfirming(false), setStake(1), setError(""))}
        >
          🎯 Mettre mon secret à prix
        </button>
      )}
      {open && (
        <div style={{ marginTop: 8, border: "1px solid #fecaca", background: "#fff7f7", borderRadius: 10, padding: 10 }}>
          {!confirming ? (
            <>
              <label className="sb-field">
                <span>Ta mise (tu as {state.points} point{state.points > 1 ? "s" : ""})</span>
                <select value={stake} onChange={(e) => setStake(Number(e.target.value))} disabled={busy}>
                  {Array.from({ length: Math.max(0, maxAllowed) }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n} point{n > 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="btn btn-main" disabled={maxAllowed < 1} onClick={() => setConfirming(true)}>
                  Continuer
                </button>
                <button className="btn btn-ghost" onClick={() => setOpen(false)}>
                  Annuler
                </button>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: 14, margin: "0 0 8px", lineHeight: 1.5 }}>
                <strong>Confirmer la mise à prix ?</strong>
                <br />• {stake} point{stake > 1 ? "s" : ""} retiré{stake > 1 ? "s" : ""} de ton score tout de suite, mis en réserve pendant {state.hours} h.
                <br />• Chaque adversaire qui propose ton prénom à tort te verse {stake} point{stake > 1 ? "s" : ""} (une fois chacun, dans la limite de ses points).
                <br />• Si ton secret est trouvé pendant ces {state.hours} h, ta mise va à celui qui l&apos;a trouvé. Sinon, elle t&apos;est rendue.
                <br />• Une seule fois par partie, pas en même temps qu&apos;une fausse identité.
              </p>
              {error && <p style={{ color: "#dc2626", fontWeight: 600, fontSize: 13, margin: "0 0 8px" }}>{error}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-main" disabled={busy} onClick={activate}>
                  {busy ? "…" : `Confirmer (${stake} pt${stake > 1 ? "s" : ""})`}
                </button>
                <button className="btn btn-ghost" disabled={busy} onClick={() => setConfirming(false)}>
                  Retour
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function LeaderItem({ state, secretOptions, onChange }: { state: LeaderState; secretOptions: { id: string; content: string }[]; onChange: (l: LeaderState) => void }) {
  const t = state.today!;
  const [secretId, setSecretId] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function post(url: string, body: object) {
    setBusy(true);
    setError("");
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) {
      setError(data.error || "Action impossible.");
      return false;
    }
    onChange(data.leader);
    return true;
  }

  const chosen = LEADER_OPTIONS.find((o) => o.choice === t.choice);
  const STATUS: Record<string, string> = { PENDING: "en attente de la réponse", REFUSED: "refusée — tu peux reformuler", CLOSED: "close (partie terminée)" };
  return (
    <div className="my-powers__item" style={{ background: "#fffbeb", borderRadius: 10, padding: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <strong>👑 Privilège du leader</strong>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#92400e" }}>{chosen ? `${chosen.icon} ${chosen.title}` : t.canChoose ? "À choisir avant 18 h" : t.reason}</span>
      </div>
      <p style={{ fontSize: 13, color: "#475569", margin: "4px 0 0" }}>
        Tu étais en tête au relevé de 9 h ({t.points} point{t.points > 1 ? "s" : ""}
        {state.coLeaders > 1 ? `, ex æquo avec ${state.coLeaders - 1} autre${state.coLeaders > 2 ? "s" : ""}` : ""}). Un seul privilège, à utiliser
        avant 18 h.
      </p>
      {t.canChoose && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {LEADER_OPTIONS.map((o) => (
            <button
              key={o.choice}
              type="button"
              disabled={busy}
              onClick={() => post("/api/game/powers/leader", { choice: o.choice })}
              style={{ textAlign: "left", border: "1px solid #fde68a", background: "#fff", borderRadius: 10, padding: "8px 10px", cursor: "pointer" }}
            >
              <strong>
                {o.icon} {o.title}
              </strong>
              <span style={{ display: "block", fontSize: 12, color: "#475569" }}>{o.text}</span>
            </button>
          ))}
        </div>
      )}
      {t.choice === "EXTRA_BUZZ" && <p style={{ fontSize: 13, margin: "6px 0 0", fontWeight: 600 }}>🔥 Tu as un buzz de plus aujourd&apos;hui.</p>}
      {t.choice === "QUESTION" && (
        <div style={{ marginTop: 8 }}>
          {t.question.map((q) => (
            <div key={q.id} style={{ fontSize: 13, border: "1px solid #e2e8f0", background: "#fff", borderRadius: 8, padding: "6px 9px", marginBottom: 6 }}>
              <div style={{ color: "#64748b" }}>Secret : « {q.secretContent} »</div>
              <div style={{ fontWeight: 700 }}>{q.text}</div>
              <div style={{ fontWeight: 700, color: q.status === "ANSWERED" ? "#15803d" : q.status === "REFUSED" ? "#b91c1c" : "#b45309" }}>
                {q.status === "ANSWERED" ? `Réponse : ${q.answer === "OUI" ? "✅ Oui" : "❌ Non"}` : `Question ${STATUS[q.status] ?? q.status}`}
              </div>
              {q.status === "REFUSED" && q.refusalReason && <div style={{ color: "#7f1d1d" }}>Motif : {q.refusalReason}</div>}
            </div>
          ))}
          {t.canAsk && (
            <>
              <label className="sb-field">
                <span>Sur quel secret ?</span>
                <select value={secretId} onChange={(e) => setSecretId(e.target.value)} disabled={busy}>
                  <option value="">Choisis un secret…</option>
                  {secretOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.content.length > 70 ? `${s.content.slice(0, 70)}…` : s.content}
                    </option>
                  ))}
                </select>
              </label>
              <label className="sb-field">
                <span>Ta question fermée (réponse Oui ou Non, jamais sur l&apos;auteur)</span>
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={300} disabled={busy} />
              </label>
              <button
                className="btn btn-main"
                disabled={busy || !secretId || text.trim().length < 8}
                onClick={async () => {
                  if (await post("/api/game/powers/leader/question", { secretId, text })) setText("");
                }}
              >
                Envoyer au maître du jeu
              </button>
            </>
          )}
        </div>
      )}
      {t.choice === "HISTORY" && (
        <div style={{ marginTop: 8 }}>
          {t.history ? (
            <div style={{ fontSize: 13, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 9px" }}>
              <div style={{ color: "#64748b" }}>Secret : « {t.history.secretContent} »</div>
              <div style={{ fontWeight: 700 }}>
                {t.history.names.length === 0 ? "Aucun prénom proposé à tort pour l'instant." : `Prénoms déjà proposés à tort : ${t.history.names.join(", ")}`}
              </div>
            </div>
          ) : t.canConsult ? (
            <>
              <label className="sb-field">
                <span>Quel secret consulter (une seule fois) ?</span>
                <select value={secretId} onChange={(e) => setSecretId(e.target.value)} disabled={busy}>
                  <option value="">Choisis un secret…</option>
                  {secretOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.content.length > 70 ? `${s.content.slice(0, 70)}…` : s.content}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn btn-main" disabled={busy || !secretId} onClick={() => post("/api/game/powers/leader/history", { secretId })}>
                🔍 Consulter gratuitement
              </button>
            </>
          ) : (
            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>{t.reason ?? "Consultation non utilisée."}</p>
          )}
        </div>
      )}
      {error && <p style={{ color: "#dc2626", fontWeight: 600, fontSize: 13, margin: "6px 0 0" }}>{error}</p>}
    </div>
  );
}
