"use client";

import type { Poste, Criterion } from "./PlanningTab";
import EvaluationBoard, { type EvalBlock } from "./EvaluationBoard";
import CriteriaBoard, { type CriterionState } from "./CriteriaBoard";
import CriteriaBoardV2, { type RatingDetail, type RatingLevelDef, type RatingMeta } from "./CriteriaBoardV2";
import { dateForDayIndex, formatDayHeader } from "@/lib/planningConfig";

// Données de la nouvelle méthode (null tant qu'EVALUATION_V2 n'est pas activé).
export type EvaluationV2Data = {
  levels: RatingLevelDef[];
  details: Record<string, RatingDetail>;
  meta: Record<string, RatingMeta>;
};

export default function DayEvaluationPanel({
  blocks,
  postes,
  criteria,
  criterionStates,
  startDate,
  dayCount,
  activeDay,
  onDayChange,
  initialNotes,
  initialNoteAuthors,
  initialRatingValues,
  canEdit,
  playerId,
  v2 = null,
}: {
  blocks: EvalBlock[];
  postes: Poste[];
  criteria: Criterion[];
  criterionStates: CriterionState[];
  startDate: string;
  dayCount: number;
  activeDay: number;
  onDayChange: (day: number) => void;
  initialNotes: Record<string, string>;
  initialNoteAuthors: Record<string, string | null>;
  initialRatingValues: Record<string, string>;
  canEdit: boolean;
  playerId: string;
  v2?: EvaluationV2Data | null;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <button
          className="btn btn-ghost"
          onClick={() => onDayChange(Math.max(0, activeDay - 1))}
          disabled={activeDay === 0}
          style={{ padding: "6px 10px" }}
        >
          ←
        </button>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Array.from({ length: dayCount }, (_, i) => i).map((d) => (
            <button
              key={d}
              onClick={() => onDayChange(d)}
              style={{
                background: activeDay === d ? "#0f766e" : "#fff",
                color: activeDay === d ? "#fff" : "#0f766e",
                border: "2px solid #0f766e",
                borderRadius: 10,
                padding: "6px 10px",
                fontWeight: 800,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {formatDayHeader(dateForDayIndex(startDate, d))}
            </button>
          ))}
        </div>

        <button
          className="btn btn-ghost"
          onClick={() => onDayChange(Math.min(dayCount - 1, activeDay + 1))}
          disabled={activeDay === dayCount - 1}
          style={{ padding: "6px 10px" }}
        >
          →
        </button>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 800, marginBottom: 10, color: "#0f172a" }}>Créneaux évalués</div>
        <EvaluationBoard
          blocks={blocks}
          postes={postes}
          activeDay={activeDay}
          initialNotes={initialNotes}
          initialAuthors={initialNoteAuthors}
          canEdit={canEdit}
          playerId={playerId}
        />
      </div>

      <div>
        <div style={{ fontWeight: 800, marginBottom: 10, color: "#0f172a" }}>Critères du jour</div>
        {v2 ? (
          <CriteriaBoardV2
            criteria={criteria}
            levels={v2.levels}
            legacyStates={criterionStates}
            activeDay={activeDay}
            initialValues={initialRatingValues}
            initialDetails={v2.details}
            initialMeta={v2.meta}
            canEdit={canEdit}
            playerId={playerId}
          />
        ) : (
          <CriteriaBoard
            criteria={criteria}
            states={criterionStates}
            activeDay={activeDay}
            initialValues={initialRatingValues}
            canEdit={canEdit}
            playerId={playerId}
          />
        )}
      </div>
    </div>
  );
}
