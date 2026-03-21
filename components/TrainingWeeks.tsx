import { TrainingWeek, Category, Day, Actual, Prescription, SessionChange } from "../lib/types";
import WeekCard from "./WeekCard";

interface Props {
  weeks: TrainingWeek[];
  blockId: string;
  blockGoal: string;
  expandedWeek: string | null;
  currentWeekId: string | null;
  todayDay: Day;
  onToggleExpand: (weekId: string) => void;
  onToggleSession: (blockId: string, weekId: string, sessionId: string, current: boolean) => void;
  onCategoryChange: (blockId: string, weekId: string, sessionId: string, category: Category) => void;
  onLogActual: (blockId: string, weekId: string, sessionId: string, actual: Actual) => void;
  onEditPrescription: (blockId: string, weekId: string, sessionId: string, category: Category, prescription: Prescription) => Promise<void>;
  onApplyChanges: (changes: SessionChange[], meta: { firstMessage: string; summary: string }) => Promise<void>;
}

export default function TrainingWeeks({
  weeks, blockId, blockGoal, expandedWeek, currentWeekId, todayDay,
  onToggleExpand, onToggleSession, onCategoryChange, onLogActual, onEditPrescription, onApplyChanges
}: Props) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Training Plan</h2>
      <div className="flex flex-col gap-2">
        {weeks.map((week, index) => (
          <WeekCard
            key={week.id}
            week={week}
            index={index}
            totalWeeks={weeks.length}
            previousWeek={index > 0 ? weeks[index - 1] : null}
            blockGoal={blockGoal}
            isExpanded={expandedWeek === week.id}
            isCurrentWeek={week.id === currentWeekId}
            todayDay={todayDay}
            blockId={blockId}
            onToggleExpand={() => onToggleExpand(week.id)}
            onToggleSession={onToggleSession}
            onCategoryChange={onCategoryChange}
            onLogActual={onLogActual}
            onEditPrescription={onEditPrescription}
            onApplyChanges={onApplyChanges}
          />
        ))}
      </div>
    </div>
  );
}
