"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PendingBlock } from "@/lib/pendingEvaluations";

const AUTOSAVE_IDLE_MS = 2 * 60 * 1000; // 2 min sans y retoucher

function fmt(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function PendingEvaluationsReminder({ initialBlocks }: { initialBlocks: PendingBlock[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [blocks, setBlocks] = useState(initialBlocks);
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    for (const b of initialBlocks) for (const s of b.stagiaires) d[`${b.id}:${s.id}`] = s.note;
    return d;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const lastEditedRef = useRef<Record<string, number>>({});
  const savingKeysRef = useRef<Set<string>>(new Set());
  const stateRef = useRef({ blocks, drafts });
  useEffect(() => {
    stateRef.current = { blocks, drafts };
  }, [blocks, drafts]);

  // Auto-enregistrement : toutes les 5s, toute case remplie et pas retouchée depuis 2 min est
  // sauvegardée puis disparaît de la liste — pour ne jamais perdre une saisie oubliée sans clic sur
  // "Enregistrer".
  useEffect(() => {
    const id = setInterval(async () => {
      const { blocks: curBlocks, drafts: curDrafts } = stateRef.current;
      const now = Date.now();
      const due: { blockId: string; playerId: string; note: string; key: string }[] = [];

      for (const b of curBlocks) {
        for (const s of b.stagiaires) {
          const key = `${b.id}:${s.id}`;
          const value = curDrafts[key] ?? "";
          if (!value.trim() || savingKeysRef.current.has(key)) continue;
          const editedAt = lastEditedRef.current[key];
          if (editedAt && now - editedAt >= AUTOSAVE_IDLE_MS) {
            due.push({ blockId: b.id, playerId: s.id, note: value, key });
          }
        }
      }
      if (due.length === 0) return;

      for (const entry of due) savingKeysRef.current.add(entry.key);
      try {
        for (const entry of due) {
          await fetch("/api/evaluations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // base: "" — ce pop-up ne liste que des retours pas encore remplis, donc la valeur de
            // départ est toujours vide. Sans ce champ, /api/evaluations retombe sur base = note, ce
            // qui fait croire à la détection de conflit qu'il n'y a "rien de nouveau" à ajouter et
            // efface le texte tout juste tapé (en laissant quand même l'auteur enregistré).
            body: JSON.stringify({ blockId: entry.blockId, playerId: entry.playerId, note: entry.note, base: "" }),
          });
        }
        const doneKeys = new Set(due.map((e) => e.key));
        setBlocks((bs) =>
          bs
            .map((b) => ({ ...b, stagiaires: b.stagiaires.filter((s) => !doneKeys.has(`${b.id}:${s.id}`)) }))
            .filter((b) => b.stagiaires.length > 0)
        );
        router.refresh();
      } catch {
        // ignore transient network errors, retry on next tick
      } finally {
        for (const entry of due) savingKeysRef.current.delete(entry.key);
      }
    }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!open || blocks.length === 0) return null;

  function setDraft(blockId: string, playerId: string, value: string) {
    setDrafts((d) => ({ ...d, [`${blockId}:${playerId}`]: value }));
    lastEditedRef.current[`${blockId}:${playerId}`] = Date.now();
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const toSave: { blockId: string; playerId: string; note: string }[] = [];
      for (const b of blocks) {
        for (const s of b.stagiaires) {
          const key = `${b.id}:${s.id}`;
          if ((drafts[key] ?? "").trim()) {
            toSave.push({ blockId: b.id, playerId: s.id, note: drafts[key] ?? "" });
          }
        }
      }
      for (const entry of toSave) {
        await fetch("/api/evaluations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...entry, base: "" }),
        });
      }

      // Retire les stagiaires désormais remplis (et les créneaux devenus complets) de l'affichage.
      const savedKeys = new Set(toSave.map((e) => `${e.blockId}:${e.playerId}`));
      setBlocks((bs) =>
        bs
          .map((b) => ({ ...b, stagiaires: b.stagiaires.filter((s) => !savedKeys.has(`${b.id}:${s.id}`)) }))
          .filter((b) => b.stagiaires.length > 0)
      );
      router.refresh();
    } catch {
      setError("Erreur réseau, réessaie.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sb-backdrop" onMouseDown={() => setOpen(false)}>
      <div className="sb-modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: "85vh", overflowY: "auto" }}>
        <div className="sb-modal__header">
          <h2>📝 Retours à saisir</h2>
        </div>

        <p className="sb-help">
          Ces créneaux sont terminés et tu en es responsable — il manque au moins un retour. Remplis ce que tu peux
          directement ici : c&apos;est enregistré automatiquement 2 min après ta dernière frappe sur une case, pas
          besoin de cliquer sur &laquo;&nbsp;Enregistrer&nbsp;&raquo; pour ne rien perdre.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {blocks.map((b) => (
            <div key={b.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>
                {b.label} · Jour {b.day + 1} · {fmt(b.startMin)}–{fmt(b.endMin)}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {b.stagiaires.map((s) => (
                  <label key={s.id} className="sb-field">
                    <span>{s.firstName}</span>
                    <textarea
                      value={drafts[`${b.id}:${s.id}`] ?? ""}
                      onChange={(e) => setDraft(b.id, s.id, e.target.value)}
                      rows={2}
                      placeholder="Retour..."
                      disabled={saving}
                      style={{ resize: "vertical" }}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div
            style={{
              marginTop: 12,
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

        <div className="sb-actions">
          <button className="sb-btn sb-btn--ghost" onClick={() => setOpen(false)} disabled={saving}>
            Plus tard
          </button>
          <button className="sb-btn sb-btn--main" onClick={save} disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer maintenant"}
          </button>
        </div>
      </div>
    </div>
  );
}
