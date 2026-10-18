"use client";

import { useState } from "react";
import type { Poste, Criterion } from "./PlanningTab";
import type { EvalBlock } from "./EvaluationBoard";
import type { CriterionState } from "./CriteriaBoard";
import DayEvaluationPanel, { type EvaluationV2Data } from "./DayEvaluationPanel";
import TrendCircle from "@/components/TrendCircle";
import type { TrendCell } from "@/lib/trendData";
import { dateForDayIndex, formatDayHeader } from "@/lib/planningConfig";
import PlayerNotesPanel, { type Notes } from "./PlayerNotesPanel";
import { legacyScoreAngle as scoreAngle, legacyScoreColor as scoreColor } from "@/lib/legacyTrend";

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
  trendCells = null,
  v2 = null,
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
  trendCells?: TrendCell[] | null; // nouvelle méthode : statut d'évolution de chaque jour
  v2?: EvaluationV2Data | null;
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

        {trendCells ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 32 }} aria-label="Évolution jour par jour">
            {trendCells.map((cell, d) => (
              <TrendCircle
                key={d}
                playerId={playerId}
                day={d}
                status={cell.status}
                compared={cell.compared}
                dayName={`J${d + 1}`}
                dayLabel={formatDayHeader(dateForDayIndex(startDate, d))}
                variant="strip"
                onOpen={() => setActiveDay(d)}
              />
            ))}
          </div>
        ) : (
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
        )}

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
          v2={v2}
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
