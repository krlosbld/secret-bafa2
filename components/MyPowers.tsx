"use client";

import { useEffect, useState } from "react";
import type { MysteryState } from "@/lib/mysteryBuzz";
import type { FakeIdentityState } from "@/lib/fakeIdentity";

// « Mes pouvoirs » (onglet Jeu, joueur) : uniquement les pouvoirs du joueur connecté.
// Rafraîchi régulièrement (réponse du maître du jeu, fin d'un camouflage).
const STATUS: Record<string, { label: string; tone: string }> = {
  PENDING: { label: "En attente de la réponse du maître du jeu", tone: "#b45309" },
  ANSWERED: { label: "Réponse", tone: "#15803d" },
  REFUSED: { label: "Refusée — tu peux reformuler", tone: "#b91c1c" },
  CLOSED: { label: "Close (partie terminée)", tone: "#64748b" },
};

type Powers = { mystery: MysteryState; fakeIdentity: FakeIdentityState };

function remaining(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "terminée";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
}
const day = (iso: string) => new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function MyPowers({ initial }: { initial: Powers }) {
  const [state, setState] = useState(initial);
  const [, setTick] = useState(0);

  async function reload() {
    const res = await fetch("/api/game/powers", { cache: "no-store" }).catch(() => null);
    const data = res?.ok ? await res.json().catch(() => null) : null;
    if (data?.ok) setState({ mystery: data.mystery, fakeIdentity: data.fakeIdentity });
  }

  useEffect(() => {
    const id = setInterval(() => {
      void reload();
      setTick((t) => t + 1); // temps restant
    }, 20000);
    return () => clearInterval(id);
  }, []);

  const { mystery, fakeIdentity } = state;
  const showMystery = mystery.enabled || mystery.questions.length > 0;
  const showFake = fakeIdentity.enabled || fakeIdentity.used !== null;
  const answered = mystery.questions.find((q) => q.status === "ANSWERED");

  return (
    <section className="card my-powers" style={{ marginBottom: 20 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>Mes pouvoirs</div>

      {showFake && <FakeIdentityItem state={fakeIdentity} onBought={(f) => setState((s) => ({ ...s, fakeIdentity: f }))} />}

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
