import { useState } from "react";
import { TrainingWeek, Category, Day, Actual, Prescription, SessionChange } from "../lib/types";
import SessionRow from "./SessionRow";
import RegenerateWeekModal from "./RegenerateWeekModal";

interface Props {
  week: TrainingWeek;
  index: number;
  totalWeeks: number;
  previousWeek: TrainingWeek | null;
  blockGoal: string;
  isExpanded: boolean;
  isCurrentWeek: boolean;
  todayDay: Day;
  blockId: string;
  onToggleExpand: () => void;
  onToggleSession: (blockId: string, weekId: string, sessionId: string, current: boolean) => void;
  onCategoryChange: (blockId: string, weekId: string, sessionId: string, category: Category) => void;
  onLogActual: (blockId: string, weekId: string, sessionId: string, actual: Actual) => void;
  onEditPrescription: (blockId: string, weekId: string, sessionId: string, category: Category, prescription: Prescription) => Promise<void>;
  onApplyChanges: (changes: SessionChange[], meta: { firstMessage: string; summary: string }) => Promise<void>;
}

export default function WeekCard({
  week, index, totalWeeks, previousWeek, blockGoal, isExpanded, isCurrentWeek, todayDay, blockId,
  onToggleExpand, onToggleSession, onCategoryChange, onLogActual, onEditPrescription, onApplyChanges
}: Props) {
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const activeSessions = week.sessions.filter(s => s.category && s.category !== "Rest");
  const completed = activeSessions.filter(s => s.completed).length;
  const total = activeSessions.length;

  return (
    <div className={`border rounded ${isCurrentWeek ? "border-blue-400" : "border-gray-200"}`}>
      <div
        onClick={onToggleExpand}
        className="flex justify-between items-center p-4 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {isCurrentWeek && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Current</span>
          )}
          <span className="font-semibold">Week {index + 1}</span>
        </div>

        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>{completed}/{total}</span>
          <span>{week.startDate} → {week.endDate}</span>
          <button
            onClick={e => { e.stopPropagation(); setRegenerateOpen(true); }}
            className="text-stone-300 hover:text-stone-600 text-[13px] leading-none transition-colors"
            title="Regenerate this week"
          >
            ↺
          </button>
          <span>{isExpanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-2">
          {week.sessions.map(session => (
            <SessionRow
              key={session.id}
              session={session}
              blockId={blockId}
              weekId={week.id}
              isToday={isCurrentWeek && session.day === todayDay}
              onToggle={onToggleSession}
              onCategoryChange={onCategoryChange}
              onLogActual={onLogActual}
              onEditPrescription={onEditPrescription}
            />
          ))}
        </div>
      )}
      {regenerateOpen && (
        <RegenerateWeekModal
          week={week}
          weekIndex={index}
          totalWeeks={totalWeeks}
          previousWeek={previousWeek}
          blockGoal={blockGoal}
          onApply={onApplyChanges}
          onClose={() => setRegenerateOpen(false)}
        />
      )}
    </div>
  );
}
