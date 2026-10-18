"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ParticipantRow } from "@/lib/gameReadiness";
import { startPlan } from "@/lib/gameStartPlan";

// Espace du maître du jeu — participants : prêts à jouer, propositions à valider, refus à
// reproposer, sans secret (délai de 24 h), exclus ou expirés, refus et sans réponse. Pendant les
// inscriptions : « Exclure du jeu » et « Commencer le jeu », qui valide et publie les secrets en
// attente et exclut les inscrits sans secret et ceux qui n'ont pas répondu (lib/gameStartPlan).

function left(deadline: string): string {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "délai dépassé";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")} restantes` : `${m} min restantes`;
}

const names = (items: ParticipantRow[]) => items.map((p) => p.firstName).join(", ");

export default function ParticipantsBoard({
  status,
  participants,
}: {
  status: "inscriptions_ouvertes" | "en_cours" | "termine";
  participants: ParticipantRow[];
}) {
  const router = useRouter();
  const [excluding, setExcluding] = useState<ParticipantRow | null>(null);
  const [starting, setStarting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = participants.filter((p) => p.participation === "ACCEPTED");
  const ready = active.filter((p) => p.secretStatus === "PUBLISHED" || p.secretStatus === "FOUND");
  const pending = active.filter((p) => p.secretStatus === "PENDING");
  const rejected = active.filter((p) => p.secretStatus === "REJECTED");
  const noSecret = active.filter((p) => !p.secretStatus);
  const out = participants.filter((p) => p.participation === "EXCLUDED" || p.participation === "EXPIRED");
  const declined = participants.filter((p) => p.participation === "DECLINED");
  const invited = participants.filter((p) => !p.participation);
  const plan = startPlan(participants);
  const canStart = plan.players > 0;
  const registering = status === "inscriptions_ouvertes";

  async function post(url: string, body: unknown): Promise<boolean> {
    setBusy(true);
    setError(null);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) {
      setError(data.error || "L'opération a échoué.");
      return false;
    }
    router.refresh();
    return true;
  }

  const row = (p: ParticipantRow, extra: React.ReactNode, canExclude: boolean) => (
    <div key={p.id} className="pb-row">
      <div>
        <strong>{p.firstName}</strong> <span className="pb-extra">{extra}</span>
      </div>
      {registering && canExclude && (
        <button type="button" className="btn btn-ghost pb-exclude" onClick={() => setExcluding(p)}>
          Exclure du jeu
        </button>
      )}
    </div>
  );

  const group = (title: string, items: ParticipantRow[], render: (p: ParticipantRow) => React.ReactNode) =>
    items.length > 0 && (
      <div className="pb-group">
        <div className="pb-group__title">
          {title} ({items.length})
        </div>
        {items.map(render)}
      </div>
    );

  return (
    <div className="card pb">
      <div className="pb-summary">
        <span className="pb-pill pb-pill--ok">✅ {ready.length} prêt{ready.length > 1 ? "s" : ""} à jouer</span>
        {pending.length > 0 && <span className="pb-pill pb-pill--wait">⏳ {pending.length} à valider</span>}
        {rejected.length > 0 && <span className="pb-pill pb-pill--ko">❌ {rejected.length} à reproposer</span>}
        {noSecret.length > 0 && <span className="pb-pill">✍️ {noSecret.length} sans secret</span>}
        <span className="pb-pill pb-pill--muted">
          {invited.length} sans réponse · {declined.length} refus · {out.length} exclu{out.length > 1 ? "s" : ""}/expiré{out.length > 1 ? "s" : ""}
        </span>
      </div>

      {group("Secret validé", ready, (p) => row(p, p.secretStatus === "FOUND" ? "· secret trouvé" : "· prêt", true))}
      {group("Propositions en attente de validation", pending, (p) => row(p, "· à valider dans « Secrets en attente »", true))}
      {group("Secrets refusés — nouvelle proposition attendue", rejected, (p) => row(p, p.lastReason ? `· motif : ${p.lastReason}` : "", true))}
      {group("Inscrits sans secret", noSecret, (p) => row(p, p.deadline ? `· ${left(p.deadline)}` : "", true))}
      {group("Exclus ou expirés", out, (p) =>
        row(p, `· ${p.participation === "EXCLUDED" ? "exclu" : "expiré"}${p.exitAt ? ` le ${new Date(p.exitAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}` : ""}${p.exitBy && p.participation === "EXCLUDED" ? (p.exitBy.startsWith("Démarrage du jeu") ? ` — ${p.exitBy.replace("Démarrage du jeu", "au démarrage du jeu")}` : ` par ${p.exitBy}`) : ""}`, false)
      )}
      {group("Ont refusé de jouer", declined, (p) => row(p, "", false))}
      {registering && group("Pas encore répondu à l'invitation", invited, (p) => row(p, "", false))}

      {registering && (
        <div className="pb-start">
          {!canStart && <div className="pb-blockers">Aucun inscrit n&apos;a encore proposé de secret : la partie ne peut pas commencer.</div>}
          <button type="button" className="btn btn-main" disabled={!canStart || busy} onClick={() => setStarting(true)} style={{ fontSize: 15, padding: "10px 18px" }}>
            ▶️ Commencer le jeu ({plan.players} joueur{plan.players > 1 ? "s" : ""})
          </button>
        </div>
      )}
      {error && <p style={{ color: "#dc2626", fontWeight: 700, fontSize: 14, margin: "10px 0 0" }}>{error}</p>}

      {(excluding || starting) && (
        <div className="sb-backdrop" onMouseDown={() => !busy && (setExcluding(null), setStarting(false))}>
          <div className="sb-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <p style={{ margin: "0 0 14px", fontSize: 15, lineHeight: 1.5, fontWeight: 600 }}>
              {excluding
                ? "Exclure ce participant du Jeu des secrets ? Il ne pourra plus rejoindre cette partie. Cette action ne modifiera pas son inscription à la formation."
                : `Commencer la partie avec ${plan.players} joueur${plan.players > 1 ? "s" : ""} ? Les inscriptions seront définitivement fermées et les secrets seront visibles par les joueurs.`}
            </p>
            {starting && !excluding && (
              <ul className="pb-plan">
                {plan.publish.length > 0 && (
                  <li>
                    ✅ <strong>{plan.publish.length} secret{plan.publish.length > 1 ? "s" : ""} en attente</strong> {plan.publish.length > 1 ? "seront validés et publiés" : "sera validé et publié"} : {names(plan.publish)}
                  </li>
                )}
                {plan.excludeNoSecret.length > 0 && (
                  <li>
                    🚫 <strong>Exclu{plan.excludeNoSecret.length > 1 ? "s" : ""} faute de secret</strong> : {names(plan.excludeNoSecret)}
                  </li>
                )}
                {plan.excludeNoAnswer.length > 0 && (
                  <li>
                    🚫 <strong>Exclu{plan.excludeNoAnswer.length > 1 ? "s" : ""} faute de réponse</strong> : {names(plan.excludeNoAnswer)}
                  </li>
                )}
              </ul>
            )}
            {excluding && <p style={{ margin: "-8px 0 18px", color: "#475569" }}>Participant : <strong>{excluding.firstName}</strong></p>}
            <div className="sb-actions">
              <button className="sb-btn sb-btn--ghost" disabled={busy} onClick={() => (setExcluding(null), setStarting(false))}>
                Annuler
              </button>
              <button
                className="sb-btn sb-btn--main"
                disabled={busy}
                onClick={async () => {
                  const done = excluding ? await post("/api/game/exclude", { playerId: excluding.id }) : await post("/api/game/start", {});
                  if (done) {
                    setExcluding(null);
                    setStarting(false);
                  }
                }}
              >
                {busy ? "…" : excluding ? "Confirmer l'exclusion" : "Commencer la partie"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
