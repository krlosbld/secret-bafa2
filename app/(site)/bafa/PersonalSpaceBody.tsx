"use client";

import { useState } from "react";
import type { Poste, Criterion } from "./PlanningTab";
import type { EvalBlock } from "./EvaluationBoard";
import type { CriterionState } from "./CriteriaBoard";
import DayEvaluationPanel from "./DayEvaluationPanel";
import PlayerNotesPanel, { type Notes } from "./PlayerNotesPanel";

const SCORE_MIN = -1;
const SCORE_MAX = 2;

function lerpColor(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}

function scoreColor(score: number): string {
  if (score <= 0) {
    const t = Math.min(1, Math.max(0, (score - SCORE_MIN) / (0 - SCORE_MIN)));
    return lerpColor("#dc2626", "#f59e0b", t);
  }
  const t = Math.min(1, Math.max(0, score / SCORE_MAX));
  return lerpColor("#f59e0b", "#16a34a", t);
}

function scoreAngle(score: number): number {
  const t = Math.min(1, Math.max(0, (score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)));
  return 180 - t * 180;
}

export default function PersonalSpaceBody({
  playerId,
  evalBlocks,
  postes,
  criteria,
  criterionStates,
  startDate,
  dayCount,
  notes,
  noteAuthors,
  ratingValues,
  canEditEvaluations,
  fillRatios,
  trends,
  playerNotes,
  initialRemarks,
  initialRemarkAuthors,
  initialDay,
}: {
  playerId: string;
  evalBlocks: EvalBlock[];
  postes: Poste[];
  criteria: Criterion[];
  criterionStates: CriterionState[];
  startDate: string;
  dayCount: number;
  notes: Record<string, string>;
  noteAuthors: Record<string, string | null>;
  ratingValues: Record<string, string>;
  canEditEvaluations: boolean;
  fillRatios: number[];
  trends: (number | null)[];
  playerNotes: Notes | null;
  initialRemarks: Record<number, string>;
  initialRemarkAuthors: Record<number, string | null>;
  initialDay: number;
}) {
  const [activeDay, setActiveDay] = useState(initialDay);

  return (
    <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
      <div style={{ flex: "2 1 480px", minWidth: 0 }}>
        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          {fillRatios.map((ratio, d) => (
            <div
              key={d}
              title={`J${d + 1} : ${Math.round(ratio * 100)}% rempli`}
              style={{ width: 26, height: 8, borderRadius: 4, background: "#e2e8f0", overflow: "hidden" }}
            >
              <div style={{ width: `${Math.round(ratio * 100)}%`, height: "100%", background: "#0f766e" }} />
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 32 }}>
          {trends.map((score, d) => {
            const color = score === null ? "#cbd5e1" : scoreColor(score);
            const glyph = score === null ? "→" : "↑";
            const transform = score === null ? undefined : `rotate(${scoreAngle(score)}deg)`;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setActiveDay(d)}
                title={`J${d + 1}`}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 24,
                    height: 24,
                    fontSize: 20,
                    lineHeight: "24px",
                    textAlign: "center",
                    fontWeight: 900,
                    color,
                    transform,
                  }}
                >
                  {glyph}
                </span>
              </button>
            );
          })}
        </div>

        <DayEvaluationPanel
          blocks={evalBlocks}
          postes={postes}
          criteria={criteria}
          criterionStates={criterionStates}
          startDate={startDate}
          dayCount={dayCount}
          activeDay={activeDay}
          onDayChange={setActiveDay}
          initialNotes={notes}
          initialNoteAuthors={noteAuthors}
          initialRatingValues={ratingValues}
          canEdit={canEditEvaluations}
          playerId={playerId}
        />
      </div>

      <div style={{ flex: "1 1 280px", minWidth: 260 }}>
        {playerNotes && (
          <PlayerNotesPanel
            playerId={playerId}
            canEditPersonal={!canEditEvaluations}
            canEditStaffNotes={canEditEvaluations}
            initialNotes={playerNotes}
            startDate={startDate}
            activeDay={activeDay}
            initialRemarks={initialRemarks}
            initialRemarkAuthors={initialRemarkAuthors}
          />
        )}
      </div>
    </div>
  );
}
