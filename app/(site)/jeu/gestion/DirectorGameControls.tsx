"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GAME_RULES } from "@/lib/gameRules";

// Directeur de la session : lancer le Jeu des secrets (réglages + maître du jeu), puis changer de
// maître du jeu. Ne donne pas accès aux secrets.

type Staff = { playerId: string; name: string; role: string };

async function post(url: string, body: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return res.ok ? null : data.error || "L'opération a échoué.";
  } catch {
    return "Connexion impossible.";
  }
}

export default function DirectorGameControls({
  launched,
  status = "inscriptions_ouvertes",
  launchedAt,
  ended,
  gameMaster,
  selfPlayerId = null,
  staff,
  defaults,
  compact = false,
}: {
  launched: boolean;
  status?: "non_configure" | "inscriptions_ouvertes" | "en_cours" | "termine";
  launchedAt: string | null;
  ended: boolean;
  gameMaster: { id: string; firstName: string } | null;
  selfPlayerId?: string | null; // le directeur : maître du jeu proposé par défaut
  staff: Staff[];
  defaults: { buzzQuota: number; rules: Record<string, boolean> };
  compact?: boolean; // onglet Jeu, jeu lancé : une seule ligne « Maître du jeu : X · Changer »
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"launch" | "master" | null>(null);
  const [quota, setQuota] = useState(defaults.buzzQuota);
  const [rules, setRules] = useState(defaults.rules);
  const defaultMaster = gameMaster?.id ?? (selfPlayerId && staff.some((s) => s.playerId === selfPlayerId) ? selfPlayerId : "");
  const [master, setMaster] = useState<string>(defaultMaster);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const masterName = (id: string) => staff.find((s) => s.playerId === id)?.name ?? gameMaster?.firstName ?? "?";

  async function launch() {
    if (!master) return setError("Choisis le maître du jeu.");
    if (!confirm(`Ouvrir les inscriptions au Jeu des secrets, avec ${masterName(master)} comme maître du jeu ?\n\nLes stagiaires seront invités à participer à leur prochaine connexion. La partie commencera quand le maître du jeu l'aura démarrée.`)) return;
    setBusy(true);
    setError(null);
    const err = await post("/api/game/launch", { buzzQuota: quota, rules, gameMasterPlayerId: master });
    setBusy(false);
    if (err) return setError(err);
    setDialog(null);
    router.refresh();
  }

  async function changeMaster() {
    if (!master || master === gameMaster?.id) return setError("Choisis une autre personne.");
    if (
      !confirm(
        `Nommer ${masterName(master)} maître du jeu ?\n\n${gameMaster ? `${gameMaster.firstName} perdra immédiatement ses droits de maître du jeu. ` : ""}Les secrets, validations et réglages sont conservés ; le jeu continue.`
      )
    )
      return;
    setBusy(true);
    setError(null);
    const err = await post("/api/game/game-master", { playerId: master });
    setBusy(false);
    if (err) return setError(err);
    setDialog(null);
    router.refresh();
  }

  const masterSelect = (
    <label className="sb-field">
      <span>Maître du jeu</span>
      <select value={master} onChange={(e) => setMaster(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}>
        <option value="">— Choisir parmi l&apos;équipe —</option>
        {staff.map((s) => (
          <option key={s.playerId} value={s.playerId}>
            {s.name} ({s.role})
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <section style={{ marginBottom: 32 }}>
      {!launched ? (
        <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>Le Jeu des secrets n&apos;est pas encore lancé</div>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: "#64748b" }}>
              Le lancement ouvre les inscriptions : tu règles le jeu et choisis le maître du jeu, chaque stagiaire est invité à
              participer. Le maître du jeu valide les secrets puis commence la partie.
            </p>
          </div>
          <button className="btn btn-main" style={{ fontSize: 15, padding: "10px 18px" }} onClick={() => { setMaster(defaultMaster); setError(null); setDialog("launch"); }}>
            🚀 Lancer le jeu
          </button>
        </div>
      ) : compact ? (
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "#64748b" }}>
          🎭 Maître du jeu : <strong>{gameMaster?.firstName ?? "aucun"}</strong> ·{" "}
          <button
            type="button"
            onClick={() => { setMaster(""); setError(null); setDialog("master"); }}
            style={{ background: "none", border: "none", padding: 0, color: "#2c5d94", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
          >
            Changer
          </button>
        </p>
      ) : (
        <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>
              {ended || status === "termine" ? "🏁 Partie terminée" : status === "en_cours" ? "🎮 Partie en cours" : "🟢 Inscriptions ouvertes"}
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: "#64748b" }}>
              {launchedAt && `Lancé le ${new Date(launchedAt).toLocaleDateString("fr-FR")} · `}
              Maître du jeu : <strong>{gameMaster?.firstName ?? "aucun"}</strong>
            </p>
          </div>
          <button className="btn btn-ghost" onClick={() => { setMaster(""); setError(null); setDialog("master"); }}>
            🎭 Changer le maître du jeu
          </button>
        </div>
      )}

      {dialog && (
        <div className="sb-backdrop" onMouseDown={() => !busy && setDialog(null)}>
          <div className="sb-modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}>
            <div className="sb-modal__header">
              <h2>{dialog === "launch" ? "Lancer le Jeu des secrets" : "Changer le maître du jeu"}</h2>
              <button className="sb-x" onClick={() => setDialog(null)} aria-label="Fermer">
                ✕
              </button>
            </div>
            <div className="sb-form">
              {dialog === "launch" && (
                <>
                  <label className="sb-field">
                    <span>Buzz par jour et par joueur</span>
                    <input type="number" min={1} max={20} value={quota} onChange={(e) => setQuota(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} />
                  </label>
                  {GAME_RULES.map((r) => (
                    <label key={r.key} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14 }}>
                      <input type="checkbox" checked={!!rules[r.key]} onChange={(e) => setRules((cur) => ({ ...cur, [r.key]: e.target.checked }))} style={{ marginTop: 3 }} />
                      <span>
                        <strong>{r.label}</strong>
                        <span style={{ display: "block", fontSize: 12, color: "#64748b" }}>{r.description}</span>
                      </span>
                    </label>
                  ))}
                </>
              )}
              {masterSelect}
              <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                Le maître du jeu est le seul à voir les secrets, à les valider ou les refuser, et à régler le jeu ; il ne joue pas. Par
                défaut c&apos;est toi : si tu choisis quelqu&apos;un d&apos;autre, tu deviens un joueur comme les autres (secret, buzz),
                sans accès à la gestion du jeu.
              </p>
              {error && <p style={{ margin: 0, color: "#dc2626", fontWeight: 700, fontSize: 14 }}>{error}</p>}
              <div className="sb-actions">
                <button className="sb-btn sb-btn--ghost" onClick={() => setDialog(null)} disabled={busy}>
                  Annuler
                </button>
                <button className="sb-btn sb-btn--main" onClick={dialog === "launch" ? launch : changeMaster} disabled={busy || !master}>
                  {busy ? "…" : dialog === "launch" ? "🚀 Ouvrir les inscriptions" : "Confirmer le changement"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
