"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { normalize } from "@/lib/fuzzy";

type BuzzItem = {
  id: string;
  secretId: string;
  also?: { firstName: string; createdAt: string }[]; // buzz identiques regroupés (même secret, même prénom)
  guessedName: string;
  isCorrect: boolean;
  camouflagePowerId?: string | null; // fausse identité active à l'envoi (réponse jugée fausse)
  createdAt: string;
  fromPlayer: { firstName: string; code: string };
  secret: {
    content: string;
    bonus: number;
    player: { firstName: string };
  };
};

function dayKey(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(iso));
}

function dayLabel(iso: string) {
  const label = new Date(iso).toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Regroupe par jour (heure de Paris) en conservant l'ordre chronologique déjà appliqué par la requête
// (createdAt asc) — donc les jours ressortent eux aussi du plus ancien au plus récent.
function groupByDay(buzzes: BuzzItem[]): { key: string; label: string; items: BuzzItem[] }[] {
  const groups: { key: string; label: string; items: BuzzItem[] }[] = [];
  for (const b of buzzes) {
    const key = dayKey(b.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(b);
    } else {
      groups.push({ key, label: dayLabel(b.createdAt), items: [b] });
    }
  }
  return groups;
}

// Les buzz incorrects identiques (même secret, même prénom à la casse et aux accents près) sont
// regroupés sur une seule carte : une seule décision les tranche tous (voir l'API).
function mergeIdentical(buzzes: BuzzItem[]): BuzzItem[] {
  const firstByKey = new Map<string, BuzzItem>();
  const result: BuzzItem[] = [];
  for (const b of buzzes) {
    if (b.isCorrect) {
      result.push(b);
      continue;
    }
    const key = `${b.secretId}|${normalize(b.guessedName)}`;
    const first = firstByKey.get(key);
    if (first) {
      (first.also ??= []).push({ firstName: b.fromPlayer.firstName, createdAt: b.createdAt });
    } else {
      const copy = { ...b, also: [] };
      firstByKey.set(key, copy);
      result.push(copy);
    }
  }
  return result;
}

export default function AdminBuzzPending({ buzzes, locked = false }: { buzzes: BuzzItem[]; locked?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function act(id: string, action: "validate" | "reject" | "accept_as_correct") {
    setLoading(id);
    await fetch(`/api/admin/buzz/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    router.refresh();
    setLoading(null);
  }

  // Partie terminée : les buzz restés en attente sont conservés tels quels, en lecture seule.
  const lockedNote = locked && buzzes.length > 0 && (
    <p style={{ fontSize: 13, color: "#64748b", fontWeight: 700, margin: "0 0 10px" }}>
      🏁 Partie terminée : ces buzz restés en attente sont conservés tels quels et ne peuvent plus être traités (le classement final
      est figé).
    </p>
  );

  if (buzzes.length === 0)
    return <p style={{ color: "#64748b", fontSize: 14 }}>Aucun buzz en attente.</p>;

  const groups = groupByDay(mergeIdentical(buzzes));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {lockedNote}
      {groups.map((group) => (
        <div key={group.key}>
          <div
            style={{
              fontWeight: 800,
              fontSize: 13,
              color: "#0f766e",
              marginBottom: 8,
              paddingBottom: 4,
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            📅 {group.label} · {group.items.length} buzz
          </div>
          <div className="cards">
            {group.items.map((b) => (
              <div
                className="card"
                key={b.id}
                style={{
                  borderLeftColor: b.isCorrect ? "#16a34a" : "#e11d48",
                }}
              >
                <div className="row">
                  <div className="label">Buzzeur</div>
                  <div className="value">
                    {b.fromPlayer.firstName}
                    <span style={{ marginLeft: 8, fontSize: 12, color: "#94a3b8" }}>
                      {new Date(b.createdAt).toLocaleString("fr-FR", {
                        timeZone: "Europe/Paris",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
                {b.also && b.also.length > 0 && (
                  <div className="row">
                    <div className="label">Aussi</div>
                    <div className="value" style={{ fontWeight: 700 }}>
                      {b.also
                        .map(
                          (a) =>
                            `${a.firstName} (${new Date(a.createdAt).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })})`
                        )
                        .join(", ")}
                      <span style={{ display: "block", fontSize: 12, fontWeight: 400, color: "#64748b" }}>
                        {b.also.length + 1} personnes ont donné la même réponse : votre décision s&apos;applique à toutes.
                      </span>
                    </div>
                  </div>
                )}
                <div className="row">
                  <div className="label">Secret</div>
                  <div className="value" style={{ fontStyle: "italic" }}>&quot;{b.secret.content}&quot;</div>
                </div>
                <div className="row">
                  <div className="label">Réponse</div>
                  <div
                    className="value"
                    style={{
                      color: b.isCorrect ? "#16a34a" : "#e11d48",
                      fontWeight: 900,
                    }}
                  >
                    {b.guessedName} {b.isCorrect ? "✅ correct" : "❌ incorrect"}
                  </div>
                </div>
                {!b.isCorrect && !b.guessedName.startsWith("🎭") && (
                  <div className="row">
                    <div className="label">Auteur</div>
                    <div className="value" style={{ color: "#475569" }}>
                      {b.secret.player.firstName}
                      {b.camouflagePowerId && (
                        <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6b21a8" }}>
                          🎭 Fausse identité active à l&apos;envoi : réponse jugée fausse (ne pas accepter).
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {b.isCorrect && (
                  <div className="row">
                    <div className="label">Gain</div>
                    <div className="value" style={{ color: "#0f766e" }}>
                      +{2 + b.secret.bonus} pts (2 + {b.secret.bonus} bonus)
                    </div>
                  </div>
                )}
                {!locked && (
                <div className="admin-actions" style={{ marginTop: 10 }}>
                  <button
                    className="btn btn-main"
                    disabled={loading === b.id}
                    onClick={() => act(b.id, "validate")}
                  >
                    ✅ Valider
                  </button>
                  <button
                    className="btn btn-danger"
                    disabled={loading === b.id}
                    onClick={() => act(b.id, "reject")}
                  >
                    ❌ Rejeter
                  </button>
                  {!b.isCorrect && !b.guessedName.startsWith("🎭") && !b.camouflagePowerId && (
                    <button
                      className="btn btn-ghost"
                      disabled={loading === b.id}
                      title={`Le secret est celui de ${b.secret.player.firstName}`}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Accepter « ${b.guessedName} » comme bonne réponse ? Le secret est celui de ${b.secret.player.firstName}. ${b.fromPlayer.firstName} gagnera les points et le secret sera marqué trouvé.`
                          )
                        )
                          void act(b.id, "accept_as_correct");
                      }}
                    >
                      ✍️ Accepter quand même (faute de frappe)
                    </button>
                  )}
                </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
