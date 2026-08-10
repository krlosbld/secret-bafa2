"use client";

import type { Poste, Criterion } from "./PlanningTab";
import EvaluationBoard, { type EvalBlock } from "./EvaluationBoard";
import CriteriaBoard, { type CriterionState } from "./CriteriaBoard";
import { dateForDayIndex, formatDayHeader } from "@/lib/planningConfig";

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
  initialRatingValues,
  canEdit,
  playerId,
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
  initialRatingValues: Record<string, string>;
  canEdit: boolean;
  playerId: string;
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
        <EvaluationBoard blocks={blocks} postes={postes} activeDay={activeDay} initialNotes={initialNotes} canEdit={canEdit} playerId={playerId} />
      </div>

      <div>
        <div style={{ fontWeight: 800, marginBottom: 10, color: "#0f172a" }}>Critères du jour</div>
        <CriteriaBoard
          criteria={criteria}
          states={criterionStates}
          activeDay={activeDay}
          initialValues={initialRatingValues}
          canEdit={canEdit}
          playerId={playerId}
        />
      </div>
    </div>
  );
}
