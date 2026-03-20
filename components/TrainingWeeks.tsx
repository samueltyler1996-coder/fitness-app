import { TrainingWeek, Category } from "../lib/types";
import WeekCard from "./WeekCard";

interface Props {
  weeks: TrainingWeek[];
  blockId: string;
  expandedWeek: string | null;
  currentWeekId: string | null;
  onToggleExpand: (weekId: string) => void;
  onToggleSession: (blockId: string, weekId: string, sessionId: string, current: boolean) => void;
  onCategoryChange: (blockId: string, weekId: string, sessionId: string, category: Category) => void;
}

export default function TrainingWeeks({
  weeks, blockId, expandedWeek, currentWeekId,
  onToggleExpand, onToggleSession, onCategoryChange
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
            isExpanded={expandedWeek === week.id}
            isCurrentWeek={week.id === currentWeekId}
            blockId={blockId}
            onToggleExpand={() => onToggleExpand(week.id)}
            onToggleSession={onToggleSession}
            onCategoryChange={onCategoryChange}
          />
        ))}
      </div>
    </div>
  );
}
