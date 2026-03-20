import { TrainingWeek, Category } from "../lib/types";
import SessionRow from "./SessionRow";

interface Props {
  week: TrainingWeek;
  index: number;
  isExpanded: boolean;
  isCurrentWeek: boolean;
  blockId: string;
  onToggleExpand: () => void;
  onToggleSession: (blockId: string, weekId: string, sessionId: string, current: boolean) => void;
  onCategoryChange: (blockId: string, weekId: string, sessionId: string, category: Category) => void;
}

export default function WeekCard({
  week, index, isExpanded, isCurrentWeek, blockId,
  onToggleExpand, onToggleSession, onCategoryChange
}: Props) {
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
              onToggle={onToggleSession}
              onCategoryChange={onCategoryChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
