"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TREND_DISPLAY, type CriterionChange, type DayTrendStatus } from "@/lib/pedagogicalTrend";
import type { TrendDetail } from "@/lib/trendData";

// Cercle d'évolution d'une journée (nouvelle méthode) : cliquable par l'équipe comme par le stagiaire,
// il ouvre le détail critère par critère. Aucune moyenne : chaque critère est comparé à sa dernière
// observation précédente.

const STATUS_TEXT: Record<DayTrendStatus, string> = {
  progression: "Au moins un critère progresse depuis sa dernière observation, et aucun ne recule.",
  contrastee: "Certains critères progressent et d'autres reculent depuis leur dernière observation.",
  stable: "Les critères comparés sont au même niveau qu'à leur dernière observation.",
  recul: "Au moins un critère recule depuis sa dernière observation, et aucun ne progresse.",
  insuffisant: "Aucun critère de ce jour ne peut encore être comparé à une observation précédente.",
  ancienne_methode:
    "Ce jour a été évalué avec l'ancienne méthode d'évaluation. Ses appréciations restent consultables avec leurs intitulés d'origine, mais elles ne permettent pas de calculer la nouvelle évolution.",
};

const CHANGE_DISPLAY: Record<CriterionChange, { symbol: string; label: string; color: string }> = {
  progression: { symbol: "↗", label: "Progression", color: TREND_DISPLAY.progression.color },
  stable: { symbol: "→", label: "Stable", color: TREND_DISPLAY.stable.color },
  recul: { symbol: "↘", label: "Recul", color: TREND_DISPLAY.recul.color },
  premiere: { symbol: "•", label: "Première observation", color: "#94a3b8" },
};

export function trendTitle(status: DayTrendStatus, compared: number, dayName: string): string {
  const d = TREND_DISPLAY[status];
  const count = compared > 0 ? ` · ${compared} critère${compared > 1 ? "s" : ""} comparé${compared > 1 ? "s" : ""}` : "";
  return `${dayName} : ${d.label}${count}`;
}

export default function TrendCircle({
  playerId,
  day,
  status,
  compared,
  dayName,
  dayLabel,
  variant = "table",
  ficheHref,
  onOpen,
}: {
  playerId: string;
  day: number;
  status: DayTrendStatus;
  compared: number;
  dayName: string; // « J3 »
  dayLabel: string; // « mar. 12 août »
  variant?: "table" | "strip";
  ficheHref?: string; // équipe : lien vers la fiche à ce jour
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const d = TREND_DISPLAY[status];
  const empty = status === "insuffisant" || status === "ancienne_methode";
  return (
    <>
      <button
        type="button"
        className={`tc tc--${variant}${empty ? " tc--empty" : ""}`}
        data-player={playerId}
        data-day={day}
        style={{ ["--tc" as string]: d.color }}
        title={trendTitle(status, compared, dayName)}
        aria-label={`${trendTitle(status, compared, dayName)} — voir le détail`}
        onClick={() => {
          onOpen?.();
          setOpen(true);
        }}
      >
        <span aria-hidden>{d.symbol}</span>
      </button>
      {open && (
        <TrendDetailModal
          playerId={playerId}
          day={day}
          title={`${dayName} · ${dayLabel}`}
          ficheHref={ficheHref}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function TrendDetailModal({
  playerId,
  day,
  title,
  ficheHref,
  onClose,
}: {
  playerId: string;
  day: number;
  title: string;
  ficheHref?: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<TrendDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/trend?playerId=${encodeURIComponent(playerId)}&day=${day}`, { cache: "no-store" })
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!alive) return;
        if (ok && data.detail) setDetail(data.detail);
        else setError(data.error || "Détail indisponible.");
      })
      .catch(() => alive && setError("Connexion impossible."));
    return () => {
      alive = false;
    };
  }, [playerId, day]);

  const d = detail ? TREND_DISPLAY[detail.status] : null;
  const noRating = detail && detail.items.length === 0 && detail.legacy.length === 0;

  return (
    <div className="sb-backdrop" onMouseDown={onClose}>
      <div className="sb-modal tcd" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label={`Évolution ${title}`}>
        <div className="sb-modal__header">
          <h2>Évolution · {title}</h2>
          <button className="sb-x" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        {!detail && !error && <p className="sb-help">Chargement…</p>}
        {error && <p className="sb-help">{error}</p>}
        {detail && d && (
          <>
            <div className="tcd__status" style={{ ["--tc" as string]: d.color }}>
              <span className="tcd__symbol" aria-hidden>
                {d.symbol}
              </span>
              <div>
                <strong>{d.label}</strong>
                {detail.compared > 0 && (
                  <span className="tcd__count">
                    {" "}
                    · {detail.compared} critère{detail.compared > 1 ? "s" : ""} comparé{detail.compared > 1 ? "s" : ""}
                  </span>
                )}
                <p>{noRating ? "Aucune appréciation par critère ce jour-là." : STATUS_TEXT[detail.status]}</p>
              </div>
            </div>

            {detail.items.length > 0 && (
              <ul className="tcd__list">
                {detail.items.map((it) => {
                  const c = CHANGE_DISPLAY[it.change];
                  return (
                    <li key={it.criterionId} className="tcd__item">
                      <div className="tcd__row">
                        <span className="tcd__crit">
                          {it.criterion}
                          {it.archived && <span className="tcd__muted"> · critère archivé</span>}
                        </span>
                        <span className="tcd__chip" style={{ ["--tc" as string]: c.color }}>
                          {c.symbol} {c.label}
                        </span>
                      </div>
                      <div className="tcd__levels">
                        {it.change === "premiere" ? (
                          <>
                            <strong>{it.levelLabel}</strong>
                            <span className="tcd__muted"> — rien à comparer avant ce jour</span>
                          </>
                        ) : (
                          <>
                            {it.previousLevelLabel}
                            <span className="tcd__muted"> (J{(it.previousDay ?? 0) + 1})</span> → <strong>{it.levelLabel}</strong>
                          </>
                        )}
                        {it.author && <span className="tcd__muted"> · {it.author}</span>}
                      </div>
                      {it.comment && (
                        <div className={`tcd__comment${it.level === 1 ? " tcd__comment--focus" : ""}`}>
                          <span className="tcd__comment-label">{it.level === 1 ? "À approfondir" : "Commentaire"}</span>
                          {it.comment}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {detail.legacy.length > 0 && (
              <div className="tcd__legacy">
                <div className="tcd__legacy-title">Ancienne méthode d&apos;évaluation</div>
                <ul>
                  {detail.legacy.map((l, i) => (
                    <li key={i}>
                      {l.criterion} : <strong>{l.label}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="tcd__note">Chaque critère est comparé à sa dernière observation précédente. Aucune moyenne n&apos;est calculée.</p>
            {ficheHref && (
              <Link className="btn btn-ghost" href={ficheHref} onClick={onClose} style={{ padding: "6px 12px", fontSize: 13 }}>
                Ouvrir la fiche à ce jour
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
